#!/bin/bash
# Hook post-receive para despliegue automático
# Coloca este contenido en /var/repo/dentali.git/hooks/post-receive

WORK_TREE="/var/www/html/dentali"
GIT_DIR="/var/repo/dentali.git"

# Cambiar al directorio de trabajo
cd $WORK_TREE || exit

# Actualizar código desde Git
git --git-dir=$GIT_DIR --work-tree=$WORK_TREE checkout -f main

# Instalar dependencias
npm ci --production || npm install --production

# Generar cliente de Prisma
npx prisma generate

# Compilar CSS
npm run build

# Reiniciar aplicación con PM2
pm2 restart dentali || pm2 start ecosystem.config.js --name dentali

echo "✅ Despliegue completado"













