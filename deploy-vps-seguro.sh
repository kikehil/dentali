#!/bin/bash

# Script para actualizar el VPS de forma segura (con backup automático)
# Uso: ./deploy-vps-seguro.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
REMOTE_PASSWORD="Netbios+2025"

echo "🚀 Actualización segura del VPS"
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

# Función para copiar archivos
scp_copy() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" $REMOTE_USER@$REMOTE_HOST:"$2"
}

# Paso 1: Crear backup
echo -e "${YELLOW}📦 Paso 1: Creando backup de seguridad...${NC}"
./backup-vps.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al crear backup. Abortando actualización.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📤 Paso 2: Deteniendo aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 stop dentali || true"

echo ""
echo -e "${YELLOW}📋 Paso 3: Listando archivos a actualizar...${NC}"

# Archivos y directorios a actualizar (SOLO código, NO datos)
FILES_TO_UPDATE=(
    "src/controllers"
    "src/routes"
    "src/views"
    "src/middleware"
    "src/server.js"
    "src/config/config.js"
    "prisma/schema.prisma"
    "prisma/migrations"
    "package.json"
)

echo "   Archivos que se actualizarán:"
for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "   ✓ $file"
    else
        echo -e "   ${RED}⚠ No encontrado: $file${NC}"
    fi
done

echo ""
read -p "¿Continuar con la actualización? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Actualización cancelada."
    exit 1
fi

echo ""
echo -e "${YELLOW}📤 Paso 4: Copiando archivos actualizados...${NC}"

for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "   Copiando: $file"
        scp_copy "$file" "$REMOTE_PATH/"
    fi
done

echo ""
echo -e "${YELLOW}📦 Paso 5: Instalando dependencias...${NC}"
ssh_exec "cd $REMOTE_PATH && npm install"

echo ""
echo -e "${YELLOW}🔄 Paso 6: Aplicando migraciones (solo estructura, NO datos)...${NC}"
ssh_exec "cd $REMOTE_PATH && npx prisma migrate deploy"

echo ""
echo -e "${YELLOW}🔧 Paso 7: Regenerando Prisma Client...${NC}"
ssh_exec "cd $REMOTE_PATH && npx prisma generate"

echo ""
echo -e "${YELLOW}🎨 Paso 8: Compilando CSS...${NC}"
ssh_exec "cd $REMOTE_PATH && npx tailwindcss -i ./src/public/css/input.css -o ./src/public/css/output.css --minify || true"

echo ""
echo -e "${YELLOW}🚀 Paso 9: Reiniciando aplicación...${NC}"
ssh_exec "cd $REMOTE_PATH && pm2 restart dentali || pm2 start src/server.js --name dentali"
ssh_exec "cd $REMOTE_PATH && pm2 save"

echo ""
echo -e "${GREEN}✅ Actualización completada${NC}"
echo ""
echo -e "${YELLOW}📋 Verifica el estado:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 status'"
echo ""
echo -e "${YELLOW}📋 Ver logs:${NC}"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 logs dentali --lines 30'"
echo ""
echo -e "${YELLOW}💾 Si algo salió mal, restaura desde:${NC}"
echo "   ./backups/"




