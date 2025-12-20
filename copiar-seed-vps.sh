#!/bin/bash

# Script para copiar seed.js actualizado al VPS
# Ejecutar desde tu máquina local

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "📤 Copiando seed.js actualizado al VPS..."

scp prisma/seed.js $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/prisma/

echo ""
echo "✅ Archivo copiado"
echo ""
echo "Ahora en el VPS ejecuta:"
echo "  cd /var/www/html/dentali"
echo "  node prisma/seed.js"




