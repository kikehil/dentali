#!/bin/bash

# Script para verificar el estado del despliegue en el VPS

VPS_USER="root"
VPS_HOST="147.93.118.121"
VPS_PATH="/var/www/html/dentali"

echo "🔍 Verificando estado del despliegue en el VPS..."
echo ""

echo "📁 1. Verificando archivos actualizados..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali
echo "Últimos archivos modificados:"
find src/views/configuracion -name "*.ejs" -type f -exec ls -lh {} \; | head -5
echo ""
echo "Verificando si existe usuariosController.js:"
ls -lh src/controllers/usuariosController.js 2>/dev/null || echo "❌ NO EXISTE"
echo ""
echo "Verificando si existe init-modulos.js:"
ls -lh scripts/init-modulos.js 2>/dev/null || echo "❌ NO EXISTE"
ENDSSH

echo ""
echo "🗄️  2. Verificando base de datos..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali

DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Verificando tabla modulos:"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) as total_modulos FROM modulos;" 2>/dev/null || echo "❌ Tabla modulos no existe"

echo ""
echo "Verificando tabla permisos_usuarios:"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) as total_permisos FROM permisos_usuarios;" 2>/dev/null || echo "❌ Tabla permisos_usuarios no existe"

echo ""
echo "Listando módulos existentes:"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id, nombre, ruta FROM modulos LIMIT 10;" 2>/dev/null || echo "❌ No se pueden listar módulos"
ENDSSH

echo ""
echo "🔄 3. Verificando migraciones de Prisma..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali
echo "Estado de migraciones:"
npx prisma migrate status 2>&1 | head -20
ENDSSH

echo ""
echo "📦 4. Verificando aplicación..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/html/dentali
echo "Estado de PM2:"
pm2 list | grep dentali || echo "❌ Aplicación no está corriendo"
echo ""
echo "Últimas líneas del log:"
pm2 logs dentali --lines 20 --nostream 2>/dev/null | tail -10 || echo "❌ No se pueden ver logs"
ENDSSH

echo ""
echo "✅ Verificación completada"

