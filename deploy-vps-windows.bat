@echo off
REM Script de despliegue para Windows
REM Usa Git para sincronizar archivos

set VPS_USER=root
set VPS_HOST=147.93.118.121
set VPS_PATH=/var/www/html/dentali

echo.
echo ========================================
echo   Despliegue Seguro al VPS
echo ========================================
echo.

echo Paso 1: Verificando cambios locales...
git status --short
echo.
set /p CONTINUAR="¿Has hecho commit y push de los cambios? (s/n): "
if /i not "%CONTINUAR%"=="s" (
    echo.
    echo Por favor, haz commit y push primero:
    echo   git add .
    echo   git commit -m "Actualizacion del sistema"
    echo   git push
    exit /b 1
)

echo.
echo Paso 2: Creando backup de BD en el VPS...
plink -ssh %VPS_USER%@%VPS_HOST% -batch -m - << "EOF"
cd /var/www/html/dentali
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
mkdir -p backups
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > backups/backup_$(date +%%Y%%m%%d_%%H%%M%%S).sql
echo Backup creado
EOF

echo.
echo Paso 3: Sincronizando archivos via git...
plink -ssh %VPS_USER%@%VPS_HOST% -batch "cd %VPS_PATH% && git pull origin main || git pull origin master"

echo.
echo Paso 4: Instalando dependencias...
plink -ssh %VPS_USER%@%VPS_HOST% -batch "cd %VPS_PATH% && npm install --production"

echo.
echo Paso 5: Aplicando migraciones...
plink -ssh %VPS_USER%@%VPS_HOST% -batch "cd %VPS_PATH% && npx prisma generate && npx prisma migrate deploy"

echo.
echo Paso 6: Inicializando modulos...
plink -ssh %VPS_USER%@%VPS_HOST% -batch "cd %VPS_PATH% && if [ -f scripts/init-modulos.js ]; then node scripts/init-modulos.js; fi"

echo.
echo Paso 7: Reiniciando aplicacion...
plink -ssh %VPS_USER%@%VPS_HOST% -batch "cd %VPS_PATH% && pm2 restart dentali || pm2 start ecosystem.config.js"

echo.
echo ========================================
echo   Despliegue completado!
echo ========================================
echo.

