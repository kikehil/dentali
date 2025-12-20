#!/bin/bash

# Script para hacer backup completo del VPS antes de actualizar
# Uso: ./backup-vps.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
REMOTE_PASSWORD="Netbios+2025"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔄 Creando backup del VPS..."
echo ""

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función para ejecutar comandos SSH
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "$1"
}

echo -e "${YELLOW}1. Creando backup de la base de datos...${NC}"

# Obtener credenciales de la base de datos desde el VPS
DB_INFO=$(ssh_exec "cd $REMOTE_PATH && grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '\"' | tr -d \"'\"")
DB_USER=$(echo $DB_INFO | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_INFO | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_INFO | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_INFO | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_INFO | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear backup de la base de datos
echo "   Exportando base de datos: $DB_NAME"
ssh_exec "mysqldump -h $DB_HOST -P ${DB_PORT:-3306} -u $DB_USER -p$DB_PASS $DB_NAME > /tmp/backup_${TIMESTAMP}.sql"

# Descargar backup de la base de datos
echo "   Descargando backup de BD..."
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST:/tmp/backup_${TIMESTAMP}.sql "$BACKUP_DIR/db_backup_${TIMESTAMP}.sql"

# Limpiar archivo temporal en el servidor
ssh_exec "rm -f /tmp/backup_${TIMESTAMP}.sql"

echo ""
echo -e "${YELLOW}2. Creando backup de archivos importantes...${NC}"

# Crear backup de archivos en el servidor
ssh_exec "cd $REMOTE_PATH && tar -czf /tmp/files_backup_${TIMESTAMP}.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backups' \
  --exclude='logs' \
  .env \
  prisma/schema.prisma \
  prisma/migrations \
  src/controllers \
  src/routes \
  src/views \
  src/middleware \
  src/server.js \
  src/config \
  2>/dev/null || true"

# Descargar backup de archivos
echo "   Descargando backup de archivos..."
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST:/tmp/files_backup_${TIMESTAMP}.tar.gz "$BACKUP_DIR/files_backup_${TIMESTAMP}.tar.gz"

# Limpiar archivo temporal en el servidor
ssh_exec "rm -f /tmp/files_backup_${TIMESTAMP}.tar.gz"

echo ""
echo -e "${GREEN}✅ Backup completado${NC}"
echo ""
echo "📁 Archivos guardados en: $BACKUP_DIR/"
echo "   - db_backup_${TIMESTAMP}.sql"
echo "   - files_backup_${TIMESTAMP}.tar.gz"
echo ""
echo "💾 Tamaño de backups:"
du -h "$BACKUP_DIR"/*${TIMESTAMP}* 2>/dev/null || echo "   No se pudieron calcular tamaños"




