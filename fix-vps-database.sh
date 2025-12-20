#!/bin/bash

# Script para corregir la base de datos en el VPS
# Ejecutar en el VPS: bash fix-vps-database.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔧 Corrigiendo base de datos en el VPS..."
echo ""

# Crear script SQL para agregar columnas faltantes
cat > /tmp/fix_columns_vps.sql << 'SQL'
-- Verificar y agregar columnas si no existen
SET @dbname = DATABASE();
SET @tablename = 'cortes_caja';

-- Columna saldoFinalTransferenciaAzteca
SET @columnname1 = 'saldoFinalTransferenciaAzteca';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname1)
  ) > 0,
  "SELECT 'Column saldoFinalTransferenciaAzteca already exists.';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname1, " DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferenciaMp;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Columna saldoFinalTransferenciaBbva
SET @columnname2 = 'saldoFinalTransferenciaBbva';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname2)
  ) > 0,
  "SELECT 'Column saldoFinalTransferenciaBbva already exists.';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname2, " DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER ", @columnname1, ";")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Columna saldoFinalTransferenciaMp
SET @columnname3 = 'saldoFinalTransferenciaMp';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname3)
  ) > 0,
  "SELECT 'Column saldoFinalTransferenciaMp already exists.';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname3, " DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER ", @columnname2, ";")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT '✅ Columnas verificadas/agregadas correctamente';
SQL

echo "📤 Subiendo script SQL al servidor..."
scp /tmp/fix_columns_vps.sql $REMOTE_USER@$REMOTE_HOST:/tmp/fix_columns_vps.sql

echo ""
echo "🔧 Ejecutando corrección en el servidor..."
ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "1. Deteniendo aplicación..."
pm2 stop dentali || true

echo ""
echo "2. Ejecutando SQL para agregar columnas..."
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
        echo "   Ejecutando migraciones de Prisma en su lugar..."
        npx prisma migrate deploy
    else
        echo "   Conectando a: $DB_NAME en $DB_HOST"
        mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /tmp/fix_columns_vps.sql
    fi
else
    echo "⚠️  Archivo .env no encontrado, usando Prisma migrate..."
    npx prisma migrate deploy
fi

echo ""
echo "3. Regenerando Prisma Client..."
npx prisma generate

echo ""
echo "4. Reiniciando aplicación..."
pm2 restart dentali || pm2 start src/server.js --name dentali
pm2 save

echo ""
echo "✅ Corrección completada"
echo ""
echo "📋 Verifica los logs:"
echo "   pm2 logs dentali --lines 20"
EOF

# Limpiar archivo temporal
rm -f /tmp/fix_columns_vps.sql

echo ""
echo "✅ Proceso completado"




