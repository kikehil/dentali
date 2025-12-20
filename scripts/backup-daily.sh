#!/bin/bash

# Script para backup diario automático
# Agregar a crontab: 0 2 * * * /var/www/html/dentali/scripts/backup-daily.sh

cd /var/www/html/dentali
BACKUP_DIR="./backups/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Obtener credenciales
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Backup de BD
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_DIR/db_${TIMESTAMP}.sql"

# Comprimir
gzip "$BACKUP_DIR/db_${TIMESTAMP}.sql"

# Mantener solo últimos 7 días
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup diario completado: db_${TIMESTAMP}.sql.gz"




