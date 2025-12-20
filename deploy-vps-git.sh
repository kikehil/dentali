#!/bin/bash

# Script de despliegue usando Git (sin rsync)
# Ideal para Windows con Git Bash

set -e

echo "🚀 Iniciando despliegue seguro al VPS (usando Git)..."
echo ""

# Configuración
VPS_USER="root"
VPS_HOST="147.93.118.121"
VPS_PATH="/var/www/html/dentali"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  IMPORTANTE: Este script usa Git para sincronizar archivos${NC}"
echo "   Asegúrate de haber hecho commit y push de tus cambios"
echo ""
read -p "¿Has hecho commit y push de los cambios? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "Por favor, haz commit y push primero:"
    echo "  git add ."
    echo "  git commit -m 'Actualización del sistema'"
    echo "  git push"
    exit 1
fi

echo ""
echo "📦 Paso 1: Creando backup de la base de datos en el VPS..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

mkdir -p backups
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"

echo "✅ Backup creado: $BACKUP_FILE"
ENDSSH

echo ""
echo "📤 Paso 2: Sincronizando archivos via git pull..."
ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
cd ${VPS_PATH}
git pull origin main || git pull origin master
ENDSSH

echo ""
echo "📦 Paso 3: Instalando dependencias en el VPS..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali
npm install --production
ENDSSH

echo ""
echo "🔄 Paso 4: Aplicando migraciones de Prisma..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

npx prisma generate

npx prisma migrate deploy || npx prisma db push --accept-data-loss
ENDSSH

echo ""
echo "🌱 Paso 5: Inicializando módulos si no existen..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

if [ -f "scripts/init-modulos.js" ]; then
    node scripts/init-modulos.js
else
    echo "⚠️  Script init-modulos.js no encontrado"
fi
ENDSSH

echo ""
echo "🔄 Paso 6: Reiniciando la aplicación..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

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
echo "  - Backup de BD creado"
echo "  - Código actualizado via git"
echo "  - Migraciones aplicadas"
echo "  - Módulos inicializados"
echo "  - Aplicación reiniciada"
echo ""
echo -e "${YELLOW}⚠️  Verifica que la aplicación funcione correctamente${NC}"
echo "  URL: http://${VPS_HOST}"

