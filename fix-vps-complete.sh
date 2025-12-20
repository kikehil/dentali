#!/bin/bash

# Script completo para corregir problemas en el VPS
# Ejecutar desde tu máquina local

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
REMOTE_PASSWORD="Netbios+2025"

echo "🔧 Corrigiendo problemas en el VPS..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Función para ejecutar comandos SSH
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "$1"
}

echo -e "${YELLOW}1. Deteniendo aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 stop dentali || true"

echo ""
echo -e "${YELLOW}2. Creando script SQL para agregar columnas faltantes...${NC}"

# Crear script SQL
cat > /tmp/fix_columns_complete.sql << 'SQL'
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
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname1, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
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
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname2, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
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
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname3, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT '✅ Columnas verificadas/agregadas correctamente';
SQL

echo -e "${YELLOW}3. Subiendo script SQL al servidor...${NC}"
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/fix_columns_complete.sql $REMOTE_USER@$REMOTE_HOST:/tmp/fix_columns_complete.sql

echo ""
echo -e "${YELLOW}4. Ejecutando corrección en el servidor...${NC}"
ssh_exec "cd $REMOTE_PATH && bash -s" << 'EOF'
# Obtener DATABASE_URL del .env
if [ -f .env ]; then
    DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    # Extraer información de la conexión
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
        mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /tmp/fix_columns_complete.sql
    fi
else
    echo "⚠️  Archivo .env no encontrado, usando Prisma migrate..."
    npx prisma migrate deploy
fi

echo ""
echo "5. Regenerando Prisma Client..."
npx prisma generate

echo ""
echo "6. Copiando archivos corregidos (timezone)..."
# Los archivos ya deberían estar actualizados, pero verificamos
EOF

echo ""
echo -e "${YELLOW}5. Copiando archivos corregidos (timezone fix)...${NC}"
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no src/views/pos/ventas.ejs $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/src/views/pos/
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no src/views/pos/corte.ejs $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/src/views/pos/

echo ""
echo -e "${YELLOW}6. Reiniciando aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 restart dentali || pm2 start src/server.js --name dentali"
ssh_exec "cd $REMOTE_PATH && pm2 save"

echo ""
echo -e "${GREEN}✅ Corrección completada${NC}"
echo ""
echo -e "${YELLOW}📋 Verifica los logs:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 logs dentali --lines 30'"

# Limpiar
rm -f /tmp/fix_columns_complete.sql




