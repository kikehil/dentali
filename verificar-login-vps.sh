#!/bin/bash

# Script para verificar problemas de login
# Ejecutar en el VPS

cd /var/www/html/dentali

echo "🔍 Verificando problemas de login..."
echo ""

# Ver logs recientes
echo "=== Logs recientes del servidor ==="
pm2 logs dentali --lines 30 --err | tail -20
echo ""

# Verificar usuarios en la base de datos
echo "=== Verificando usuarios creados ==="
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
SELECT id, email, nombre, rol, activo FROM usuarios LIMIT 5;
SQL

echo ""
echo "=== Verificar configuración de sesiones ==="
grep -n "session\|SESSION" src/server.js | head -5




