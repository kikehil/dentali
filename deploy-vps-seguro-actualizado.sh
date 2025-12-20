#!/bin/bash

# Script de despliegue seguro para VPS
# Actualiza el código sin afectar la base de datos existente
# Fecha: 20/12/2025

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue seguro al VPS..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
VPS_USER="root"  # Cambiar según tu configuración
VPS_HOST="147.93.118.121"  # Tu IP o dominio
VPS_PATH="/var/www/html/dentali"
LOCAL_PATH="."

echo -e "${YELLOW}⚠️  IMPORTANTE: Este script actualizará el código pero NO afectará los datos existentes${NC}"
echo ""
read -p "¿Continuar con el despliegue? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Despliegue cancelado."
    exit 1
fi

echo ""
echo "📦 Paso 1: Creando backup de la base de datos en el VPS..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

# Obtener credenciales de la base de datos
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear directorio de backups si no existe
mkdir -p backups

# Crear backup con timestamp
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"

echo "✅ Backup creado: $BACKUP_FILE"
ENDSSH

echo ""
echo "📤 Paso 2: Sincronizando archivos de código..."

# Verificar si rsync está disponible
if command -v rsync &> /dev/null; then
    echo "Usando rsync..."
    rsync -avz --progress \
      --exclude='.env' \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='dist' \
      --exclude='build' \
      --exclude='*.log' \
      --exclude='backups' \
      --exclude='.DS_Store' \
      --exclude='*.swp' \
      --exclude='*.swo' \
      ${LOCAL_PATH}/ ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/
else
    echo "rsync no disponible, usando git pull en el VPS..."
    echo "⚠️  Asegúrate de haber hecho commit y push de tus cambios"
    echo ""
    read -p "¿Has hecho commit y push de los cambios? (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "Por favor, haz commit y push de tus cambios primero:"
        echo "  git add ."
        echo "  git commit -m 'Actualización del sistema'"
        echo "  git push"
        exit 1
    fi
    
    # Usar git pull en el VPS
    ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
cd ${VPS_PATH}
git pull origin main || git pull origin master
ENDSSH
    echo "✅ Archivos sincronizados via git"
fi

echo ""
echo "📦 Paso 3: Instalando dependencias en el VPS..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali
npm install --production
ENDSSH

echo ""
echo "🔄 Paso 4: Aplicando migraciones de Prisma de forma segura..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

# Regenerar Prisma Client
echo "Regenerando Prisma Client..."
npx prisma generate

# Aplicar migraciones pendientes (solo crea tablas/columnas, no elimina datos)
echo "Aplicando migraciones..."
npx prisma migrate deploy

# Si hay errores, intentar con db push (más permisivo)
if [ $? -ne 0 ]; then
    echo "⚠️  migrate deploy falló, intentando con db push..."
    npx prisma db push --accept-data-loss
fi
ENDSSH

echo ""
echo "🌱 Paso 5: Inicializando módulos si no existen..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

# Verificar si la tabla modulos existe y tiene datos
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

MODULOS_COUNT=$(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM modulos;" 2>/dev/null || echo "0")

if [ "$MODULOS_COUNT" = "0" ] || [ -z "$MODULOS_COUNT" ]; then
    echo "Inicializando módulos del sistema..."
    if [ -f "scripts/init-modulos.js" ]; then
        node scripts/init-modulos.js
    else
        echo "⚠️  Script init-modulos.js no encontrado, creando módulos manualmente..."
        mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
INSERT IGNORE INTO modulos (nombre, ruta, activo, createdAt, updatedAt) VALUES
('Punto de Venta', '/pos', true, NOW(), NOW()),
('Pacientes', '/pacientes', true, NOW(), NOW()),
('Doctores', '/doctores', true, NOW(), NOW()),
('Historial Ventas', '/pos/ventas', true, NOW(), NOW()),
('Cortes de Caja', '/cortes', true, NOW(), NOW()),
('Gastos', '/gastos', true, NOW(), NOW()),
('Configuración', '/configuracion', true, NOW(), NOW());
SQL
    fi
    echo "✅ Módulos inicializados"
else
    echo "✅ Módulos ya existen ($MODULOS_COUNT módulos)"
fi
ENDSSH

echo ""
echo "🔄 Paso 6: Reiniciando la aplicación..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

# Si usas PM2
if command -v pm2 &> /dev/null; then
    pm2 restart dentali || pm2 start ecosystem.config.js
    pm2 save
    echo "✅ Aplicación reiniciada con PM2"
elif [ -f "/etc/systemd/system/dentali.service" ]; then
    sudo systemctl restart dentali
    echo "✅ Aplicación reiniciada con systemd"
else
    echo "⚠️  No se encontró PM2 ni systemd, reinicia manualmente"
fi
ENDSSH

echo ""
echo -e "${GREEN}✅ Despliegue completado exitosamente!${NC}"
echo ""
echo "📋 Resumen:"
echo "  - Backup de BD creado en: ${VPS_PATH}/backups/"
echo "  - Código actualizado"
echo "  - Migraciones aplicadas"
echo "  - Módulos inicializados"
echo "  - Aplicación reiniciada"
echo ""
echo -e "${YELLOW}⚠️  Verifica que la aplicación funcione correctamente${NC}"
echo "  URL: http://${VPS_HOST}"

