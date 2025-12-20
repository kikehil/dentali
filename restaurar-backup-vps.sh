#!/bin/bash

# Script para restaurar un backup del VPS
# Uso: ./restaurar-backup-vps.sh [timestamp]
# Ejemplo: ./restaurar-backup-vps.sh 20251216_231500

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
REMOTE_PASSWORD="Netbios+2025"
BACKUP_DIR="./backups"

if [ -z "$1" ]; then
    echo "❌ Error: Debes especificar el timestamp del backup"
    echo ""
    echo "Backups disponibles:"
    ls -lh "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | awk '{print $9}' | sed 's/.*backup_\(.*\)\.sql/\1/' | sort -r
    echo ""
    echo "Uso: ./restaurar-backup-vps.sh [timestamp]"
    echo "Ejemplo: ./restaurar-backup-vps.sh 20251216_231500"
    exit 1
fi

TIMESTAMP=$1
DB_BACKUP="$BACKUP_DIR/db_backup_${TIMESTAMP}.sql"
FILES_BACKUP="$BACKUP_DIR/files_backup_${TIMESTAMP}.tar.gz"

if [ ! -f "$DB_BACKUP" ]; then
    echo "❌ Error: Backup de BD no encontrado: $DB_BACKUP"
    exit 1
fi

if [ ! -f "$FILES_BACKUP" ]; then
    echo "⚠️  Advertencia: Backup de archivos no encontrado: $FILES_BACKUP"
    echo "   Continuando solo con restauración de BD..."
fi

echo "🔄 Restaurando backup del $TIMESTAMP..."
echo ""

read -p "⚠️  Esto SOBRESCRIBIRÁ los datos actuales. ¿Estás seguro? (escribe 'SI' para confirmar): " -r
if [[ ! $REPLY == "SI" ]]; then
    echo "Restauración cancelada."
    exit 1
fi

# Función para ejecutar comandos SSH
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "$1"
}

# Función para copiar archivos
scp_copy() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$1" $REMOTE_USER@$REMOTE_HOST:"$2"
}

echo "1. Deteniendo aplicación..."
ssh_exec "cd $REMOTE_PATH && pm2 stop dentali || true"

echo ""
echo "2. Restaurando base de datos..."

# Obtener credenciales
DB_INFO=$(ssh_exec "cd $REMOTE_PATH && grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '\"' | tr -d \"'\"")
DB_USER=$(echo $DB_INFO | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_INFO | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_INFO | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_INFO | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_INFO | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Subir backup SQL al servidor
scp_copy "$DB_BACKUP" "/tmp/restore_backup.sql"

# Restaurar base de datos
ssh_exec "mysql -h $DB_HOST -P ${DB_PORT:-3306} -u $DB_USER -p$DB_PASS $DB_NAME < /tmp/restore_backup.sql && rm -f /tmp/restore_backup.sql"

echo ""
echo "3. Restaurando archivos..."

if [ -f "$FILES_BACKUP" ]; then
    scp_copy "$FILES_BACKUP" "/tmp/restore_files.tar.gz"
    ssh_exec "cd $REMOTE_PATH && tar -xzf /tmp/restore_files.tar.gz && rm -f /tmp/restore_files.tar.gz"
else
    echo "   ⚠️  Backup de archivos no disponible, saltando..."
fi

echo ""
echo "4. Regenerando Prisma Client..."
ssh_exec "cd $REMOTE_PATH && npx prisma generate"

echo ""
echo "5. Reiniciando aplicación..."
ssh_exec "cd $REMOTE_PATH && pm2 restart dentali || pm2 start src/server.js --name dentali"

echo ""
echo "✅ Restauración completada"




