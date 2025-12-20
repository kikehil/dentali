#!/bin/bash

# Script para corregir problemas de login en VPS
# Uso: ./fix-login-vps.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔧 Corrigiendo problemas de login en el VPS..."
echo ""

ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "1. Deteniendo aplicación..."
pm2 stop dentali || true
echo "✅ Aplicación detenida"
echo ""

echo "2. Regenerando Prisma Client..."
npx prisma generate
echo "✅ Prisma Client regenerado"
echo ""

echo "3. Verificando dependencias críticas..."
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "⚠️  @prisma/client faltante, instalando..."
    npm install @prisma/client
fi

if [ ! -d "node_modules/bcryptjs" ]; then
    echo "⚠️  bcryptjs faltante, instalando..."
    npm install bcryptjs
fi
echo "✅ Dependencias verificadas"
echo ""

echo "4. Verificando archivo .env..."
if [ ! -f .env ]; then
    echo "❌ ERROR: Archivo .env no existe"
    echo "   Necesitas crear el archivo .env con las siguientes variables:"
    echo "   DATABASE_URL=mysql://usuario:password@localhost:3306/nombre_db"
    echo "   PORT=3005"
    echo "   NODE_ENV=production"
    echo "   SESSION_SECRET=tu_secret_aleatorio"
    echo "   TZ=America/Mexico_City"
    exit 1
else
    echo "✅ Archivo .env existe"
fi
echo ""

echo "5. Probando conexión a base de datos..."
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
        console.error('   Verifica tu DATABASE_URL en el archivo .env');
        process.exit(1);
    });
" 2>&1
DB_TEST=$?
echo ""

if [ $DB_TEST -eq 0 ]; then
    echo "6. Reiniciando aplicación..."
    pm2 restart dentali || pm2 start src/server.js --name dentali
    pm2 save
    echo "✅ Aplicación reiniciada"
    echo ""
    
    echo "7. Esperando 3 segundos y verificando estado..."
    sleep 3
    pm2 status
    echo ""
    
    echo "════════════════════════════════════════════════════════════"
    echo "✅ CORRECCIÓN COMPLETADA"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "📋 Verifica los logs con:"
    echo "   pm2 logs dentali --lines 20"
    echo ""
    echo "🌐 Prueba acceder a: http://147.93.118.121:3005/login"
else
    echo "════════════════════════════════════════════════════════════"
    echo "❌ ERROR: No se pudo conectar a la base de datos"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Verifica:"
    echo "1. Que MySQL esté corriendo: systemctl status mysql"
    echo "2. Que la DATABASE_URL en .env sea correcta"
    echo "3. Que el usuario y contraseña sean correctos"
    echo "4. Que la base de datos exista"
    echo ""
    echo "Para crear la base de datos:"
    echo "   mysql -u root -p"
    echo "   CREATE DATABASE nombre_db;"
    echo "   exit"
fi
EOF

echo ""
echo "✅ Proceso completado"






