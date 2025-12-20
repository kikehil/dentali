#!/bin/bash

# Script para resetear saldos y forzar solicitud de saldo inicial
# Uso: ./reset-saldos.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔄 Reseteando saldos en la base de datos..."
echo "⚠️  Esto eliminará todos los cortes y saldos iniciales del día actual"
echo ""
read -p "¿Estás seguro de continuar? (s/N): " confirmar

if [[ ! $confirmar =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "📤 Subiendo script SQL al servidor..."
scp reset-saldos.sql $REMOTE_USER@$REMOTE_HOST:/tmp/reset-saldos.sql

echo ""
echo "🔧 Ejecutando reseteo en el servidor..."
ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "1. Deteniendo aplicación..."
pm2 stop dentali || true

echo ""
echo "2. Ejecutando SQL para resetear saldos..."
# Obtener DATABASE_URL del .env
if [ -f .env ]; then
    DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    # Extraer información de la conexión
    # Formato: mysql://user:password@host:port/database
    DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [ -z "$DB_NAME" ]; then
        echo "⚠️  No se pudo extraer información de DATABASE_URL"
        exit 1
    else
        echo "   Conectando a: $DB_NAME en $DB_HOST"
        mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /tmp/reset-saldos.sql
        echo "   ✅ Saldos reseteados correctamente"
    fi
else
    echo "⚠️  Archivo .env no encontrado"
    exit 1
fi

echo ""
echo "3. Reiniciando aplicación..."
pm2 restart dentali || pm2 start src/server.js --name dentali
pm2 save

echo ""
echo "✅ Reseteo completado"
echo ""
echo "📋 Verifica los logs:"
echo "   pm2 logs dentali --lines 20"
EOF

# Limpiar archivo temporal en servidor remoto
ssh $REMOTE_USER@$REMOTE_HOST "rm -f /tmp/reset-saldos.sql"

echo ""
echo "✅ Proceso completado"
echo ""
echo "💡 Ahora cuando accedas a /pos, el sistema te pedirá ingresar un saldo inicial"

