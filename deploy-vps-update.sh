#!/bin/bash

# Script para actualizar el VPS con los cambios realizados
# Uso: ./deploy-vps-update.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
REMOTE_PASSWORD="Netbios+2025"

echo "🚀 Iniciando actualización del VPS..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para ejecutar comandos SSH
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "$1"
}

# Función para copiar archivos
scp_copy() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" $REMOTE_USER@$REMOTE_HOST:"$2"
}

echo -e "${YELLOW}1. Conectando al servidor y deteniendo la aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 stop dentali || true"

echo ""
echo -e "${YELLOW}2. Creando backup de seguridad...${NC}"
ssh_exec "cd $REMOTE_PATH && mkdir -p backups && tar -czf backups/backup-\$(date +%Y%m%d-%H%M%S).tar.gz --exclude='node_modules' --exclude='backups' --exclude='.git' . || true"

echo ""
echo -e "${YELLOW}3. Copiando archivos actualizados...${NC}"

# Archivos y directorios a actualizar
FILES_TO_UPDATE=(
    "src/controllers/posController.js"
    "src/controllers/categoriasController.js"
    "src/routes/posRoutes.js"
    "src/routes/categoriasRoutes.js"
    "src/views/partials/header.ejs"
    "src/views/layout.ejs"
    "src/views/pos/index.ejs"
    "src/views/pos/servicios.ejs"
    "src/views/configuracion/index.ejs"
    "src/views/categorias"
    "prisma/schema.prisma"
    "prisma/migrations"
    "prisma/seed-categorias.js"
    "package.json"
)

for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "   Copiando: $file"
        scp_copy "$file" "$REMOTE_PATH/"
    else
        echo -e "   ${RED}⚠️  No encontrado: $file${NC}"
    fi
done

echo ""
echo -e "${YELLOW}4. Instalando dependencias (si hay nuevas)...${NC}"
ssh_exec "cd $REMOTE_PATH && npm install"

echo ""
echo -e "${YELLOW}5. Aplicando migraciones de base de datos...${NC}"
ssh_exec "cd $REMOTE_PATH && npx prisma migrate deploy"

echo ""
echo -e "${YELLOW}6. Regenerando Prisma Client...${NC}"
ssh_exec "cd $REMOTE_PATH && npx prisma generate"

echo ""
echo -e "${YELLOW}7. Ejecutando seed de categorías...${NC}"
ssh_exec "cd $REMOTE_PATH && node prisma/seed-categorias.js || echo 'Seed ya ejecutado o error (puede ser normal)'"

echo ""
echo -e "${YELLOW}8. Compilando CSS (Tailwind)...${NC}"
ssh_exec "cd $REMOTE_PATH && npx tailwindcss -i ./src/public/css/input.css -o ./src/public/css/output.css --minify || true"

echo ""
echo -e "${YELLOW}9. Reiniciando aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 restart dentali || pm2 start src/server.js --name dentali"
ssh_exec "cd $REMOTE_PATH && pm2 save"

echo ""
echo -e "${GREEN}✅ Actualización completada${NC}"
echo ""
echo -e "${YELLOW}📋 Verifica el estado de la aplicación:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 status'"
echo ""
echo -e "${YELLOW}📋 Ver logs recientes:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 logs dentali --lines 30'"
echo ""
echo -e "${YELLOW}📋 Verificar que las categorías se crearon:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && npx prisma studio'"
echo ""




