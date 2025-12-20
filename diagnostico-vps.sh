#!/bin/bash

# Script de diagnóstico para problemas de login en VPS
# Uso: ./diagnostico-vps.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔍 Ejecutando diagnóstico en el VPS..."
echo ""

ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "════════════════════════════════════════════════════════════"
echo "1. VERIFICANDO PROCESO DE LA APLICACIÓN"
echo "════════════════════════════════════════════════════════════"
pm2 status
echo ""

echo "════════════════════════════════════════════════════════════"
echo "2. ÚLTIMOS LOGS DE ERROR"
echo "════════════════════════════════════════════════════════════"
pm2 logs dentali --lines 50 --nostream --err
echo ""

echo "════════════════════════════════════════════════════════════"
echo "3. VERIFICANDO ARCHIVO .env"
echo "════════════════════════════════════════════════════════════"
if [ -f .env ]; then
    echo "✅ Archivo .env existe"
    echo "Variables importantes:"
    grep -E "^(DATABASE_URL|PORT|NODE_ENV|SESSION_SECRET|TZ)=" .env | sed 's/=.*/=***/' || echo "⚠️  No se encontraron variables importantes"
else
    echo "❌ Archivo .env NO existe"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "4. VERIFICANDO PRISMA CLIENT"
echo "════════════════════════════════════════════════════════════"
if [ -d "node_modules/.prisma" ]; then
    echo "✅ Prisma Client generado"
else
    echo "❌ Prisma Client NO generado"
    echo "Ejecutando: npx prisma generate"
    npx prisma generate
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "5. VERIFICANDO CONEXIÓN A BASE DE DATOS"
echo "════════════════════════════════════════════════════════════"
if [ -f .env ]; then
    DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2-)
    if [ ! -z "$DATABASE_URL" ]; then
        echo "Intentando conectar a la base de datos..."
        node -e "
        require('dotenv').config();
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
            .then(() => {
                console.log('✅ Conexión a base de datos exitosa');
                return prisma.\$disconnect();
            })
            .catch(err => {
                console.error('❌ Error de conexión:', err.message);
                process.exit(1);
            });
        " 2>&1 || echo "❌ Error al verificar conexión"
    else
        echo "⚠️  DATABASE_URL no configurada en .env"
    fi
else
    echo "⚠️  No se puede verificar sin archivo .env"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "6. VERIFICANDO NODE_MODULES"
echo "════════════════════════════════════════════════════════════"
if [ -d "node_modules" ]; then
    echo "✅ node_modules existe"
    if [ -d "node_modules/@prisma/client" ]; then
        echo "✅ @prisma/client instalado"
    else
        echo "❌ @prisma/client NO instalado"
    fi
    if [ -d "node_modules/bcryptjs" ]; then
        echo "✅ bcryptjs instalado"
    else
        echo "❌ bcryptjs NO instalado"
    fi
else
    echo "❌ node_modules NO existe"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "7. VERIFICANDO ARCHIVOS CRÍTICOS"
echo "════════════════════════════════════════════════════════════"
[ -f "src/server.js" ] && echo "✅ src/server.js existe" || echo "❌ src/server.js NO existe"
[ -f "src/controllers/authController.js" ] && echo "✅ authController.js existe" || echo "❌ authController.js NO existe"
[ -f "prisma/schema.prisma" ] && echo "✅ schema.prisma existe" || echo "❌ schema.prisma NO existe"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "8. VERIFICANDO PERMISOS"
echo "════════════════════════════════════════════════════════════"
ls -la .env 2>/dev/null || echo "⚠️  No se puede verificar permisos de .env"
ls -la src/server.js 2>/dev/null || echo "⚠️  No se puede verificar permisos de server.js"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ DIAGNÓSTICO COMPLETADO"
echo "════════════════════════════════════════════════════════════"
EOF

echo ""
echo "📋 Si hay errores, ejecuta estos comandos en el servidor:"
echo ""
echo "1. Regenerar Prisma Client:"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && npx prisma generate'"
echo ""
echo "2. Reinstalar dependencias:"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && rm -rf node_modules && npm install'"
echo ""
echo "3. Reiniciar aplicación:"
echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 restart dentali'"
echo ""






