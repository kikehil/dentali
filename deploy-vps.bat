@echo off
REM Script de despliegue para VPS (Windows)
REM Uso: deploy-vps.bat

echo.
echo ============================================
echo   DESPLIEGUE A VPS - CLINICA DENTAL
echo ============================================
echo.

REM ============================================
REM CONFIGURACIÓN - MODIFICA ESTOS VALORES
REM ============================================
set DEPLOY_USER=root
set DEPLOY_HOST=147.93.118.121
set DEPLOY_PORT=22
set DEPLOY_PATH=/var/www/html/dentali

echo Configuracion actual:
echo   Usuario: %DEPLOY_USER%
echo   Host: %DEPLOY_HOST%
echo   Puerto: %DEPLOY_PORT%
echo   Ruta: %DEPLOY_PATH%
echo.
pause

REM Verificar que existe .env
if not exist .env (
    echo ADVERTENCIA: No se encontro archivo .env
    echo Asegurate de crear el archivo .env antes de desplegar
    pause
)

REM Compilar CSS
echo Compilando CSS de Tailwind...
call npm run build
if errorlevel 1 (
    echo ADVERTENCIA: No se pudo compilar CSS
    pause
)

REM Crear estructura en servidor
echo.
echo Creando estructura de carpetas en servidor...
ssh -p %DEPLOY_PORT% %DEPLOY_USER%@%DEPLOY_HOST% "mkdir -p %DEPLOY_PATH% && mkdir -p %DEPLOY_PATH%/uploads && mkdir -p %DEPLOY_PATH%/logs"

REM Subir archivos
echo.
echo Subiendo archivos del proyecto...

echo   - Archivos de configuracion...
scp -P %DEPLOY_PORT% package.json %DEPLOY_USER%@%DEPLOY_HOST%:%DEPLOY_PATH%/
scp -P %DEPLOY_PORT% package-lock.json %DEPLOY_USER%@%DEPLOY_HOST%:%DEPLOY_PATH%/
scp -P %DEPLOY_PORT% tailwind.config.js %DEPLOY_USER%@%DEPLOY_HOST%:%DEPLOY_PATH%/

echo   - Carpeta src/...
scp -r -P %DEPLOY_PORT% src %DEPLOY_USER%@%DEPLOY_HOST%:%DEPLOY_PATH%/

echo   - Carpeta prisma/...
scp -r -P %DEPLOY_PORT% prisma %DEPLOY_USER%@%DEPLOY_HOST%:%DEPLOY_PATH%/

echo   - Carpeta uploads/...
ssh -p %DEPLOY_PORT% %DEPLOY_USER%@%DEPLOY_HOST% "mkdir -p %DEPLOY_PATH%/uploads"

REM Instalación en servidor
echo.
echo ============================================
echo   IMPORTANTE: Pasos siguientes en el servidor
echo ============================================
echo.
echo 1. Conectar por SSH:
echo    ssh -p %DEPLOY_PORT% %DEPLOY_USER%@%DEPLOY_HOST%
echo.
echo 2. Ir al directorio:
echo    cd %DEPLOY_PATH%
echo.
echo 3. Crear archivo .env con tus credenciales
echo.
echo 4. Ejecutar:
echo    npm ci --production
echo    npx prisma generate
echo    npx prisma migrate deploy
echo    node prisma/seed.js
echo    npm run build
echo    pm2 start ecosystem.config.js
echo    pm2 save
echo.
echo ============================================
echo.
pause













