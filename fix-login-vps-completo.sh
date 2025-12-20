#!/bin/bash

# Script completo para diagnosticar y corregir problemas de login en VPS
# Uso: ./fix-login-vps-completo.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔍 DIAGNÓSTICO Y CORRECCIÓN DE PROBLEMAS DE LOGIN EN VPS"
echo "════════════════════════════════════════════════════════════"
echo ""

ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "════════════════════════════════════════════════════════════"
echo "PASO 1: Verificando archivo .env"
echo "════════════════════════════════════════════════════════════"
if [ ! -f .env ]; then
    echo "❌ ERROR: Archivo .env no existe"
    echo "   Creando archivo .env desde ejemplo..."
    if [ -f env.example.txt ]; then
        cp env.example.txt .env
        echo "✅ Archivo .env creado. DEBES EDITARLO con tus datos reales"
    else
        echo "❌ No se encontró env.example.txt"
        exit 1
    fi
else
    echo "✅ Archivo .env existe"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "PASO 2: Verificando variables de entorno críticas"
echo "════════════════════════════════════════════════════════════"
source .env 2>/dev/null || true

# Verificar SESSION_SECRET
if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "tu_secret_key_muy_segura_aqui" ]; then
    echo "⚠️  SESSION_SECRET no configurado o usa valor por defecto"
    echo "   Generando nuevo SESSION_SECRET..."
    NEW_SECRET=$(openssl rand -base64 32)
    if grep -q "SESSION_SECRET=" .env; then
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$NEW_SECRET|" .env
    else
        echo "SESSION_SECRET=$NEW_SECRET" >> .env
    fi
    echo "✅ SESSION_SECRET actualizado"
else
    echo "✅ SESSION_SECRET configurado"
fi

# Verificar USE_SECURE_COOKIES (debe ser false si no hay HTTPS)
if grep -q "USE_SECURE_COOKIES=true" .env; then
    echo "⚠️  USE_SECURE_COOKIES está en true pero probablemente no tienes HTTPS"
    echo "   Cambiando a false para permitir cookies en HTTP..."
    sed -i "s|USE_SECURE_COOKIES=true|USE_SECURE_COOKIES=false|" .env
    echo "✅ USE_SECURE_COOKIES cambiado a false"
else
    if ! grep -q "USE_SECURE_COOKIES" .env; then
        echo "   Agregando USE_SECURE_COOKIES=false..."
        echo "USE_SECURE_COOKIES=false" >> .env
        echo "✅ USE_SECURE_COOKIES agregado"
    else
        echo "✅ USE_SECURE_COOKIES configurado correctamente"
    fi
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "PASO 3: Verificando conexión a base de datos"
echo "════════════════════════════════════════════════════════════"
node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
    .then(async () => {
        console.log('✅ Conexión a base de datos exitosa');
        // Verificar si hay usuarios
        const usuarios = await prisma.usuario.count();
        console.log('📊 Usuarios en la base de datos:', usuarios);
        if (usuarios === 0) {
            console.log('⚠️  No hay usuarios en la base de datos');
            console.log('   Necesitas ejecutar el seed: node prisma/seed.js');
        }
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

if [ $DB_TEST -ne 0 ]; then
    echo "════════════════════════════════════════════════════════════"
    echo "❌ ERROR: No se pudo conectar a la base de datos"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Verifica:"
    echo "1. Que MySQL esté corriendo: systemctl status mysql"
    echo "2. Que la DATABASE_URL en .env sea correcta"
    echo "3. Que el usuario y contraseña sean correctos"
    echo "4. Que la base de datos exista"
    exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "PASO 4: Verificando dependencias críticas"
echo "════════════════════════════════════════════════════════════"
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules no existe, instalando dependencias..."
    npm ci --production
    echo "✅ Dependencias instaladas"
else
    echo "✅ node_modules existe"
fi

if [ ! -d "node_modules/@prisma/client" ]; then
    echo "⚠️  @prisma/client faltante, regenerando..."
    npx prisma generate
    echo "✅ Prisma Client regenerado"
else
    echo "✅ @prisma/client existe"
fi

if [ ! -d "node_modules/bcryptjs" ]; then
    echo "⚠️  bcryptjs faltante, instalando..."
    npm install bcryptjs
    echo "✅ bcryptjs instalado"
else
    echo "✅ bcryptjs existe"
fi

if [ ! -d "node_modules/express-session" ]; then
    echo "⚠️  express-session faltante, instalando..."
    npm install express-session
    echo "✅ express-session instalado"
else
    echo "✅ express-session existe"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "PASO 5: Verificando configuración de Nginx (si existe)"
echo "════════════════════════════════════════════════════════════"
if [ -f /etc/nginx/sites-available/dentali ] || [ -f /etc/nginx/sites-enabled/dentali ]; then
    echo "✅ Configuración de Nginx encontrada"
    echo "   Verificando headers de proxy..."
    
    # Verificar si tiene los headers necesarios
    if grep -q "X-Forwarded-Proto" /etc/nginx/sites-available/dentali 2>/dev/null || grep -q "X-Forwarded-Proto" /etc/nginx/sites-enabled/dentali 2>/dev/null; then
        echo "✅ Headers de proxy configurados"
    else
        echo "⚠️  Faltan headers de proxy en Nginx"
        echo "   Asegúrate de tener estos headers en tu configuración:"
        echo "   proxy_set_header X-Real-IP \$remote_addr;"
        echo "   proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
        echo "   proxy_set_header X-Forwarded-Proto \$scheme;"
    fi
else
    echo "ℹ️  Nginx no configurado (no es crítico si accedes directamente al puerto)"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "PASO 6: Deteniendo y reiniciando aplicación"
echo "════════════════════════════════════════════════════════════"
pm2 stop dentali 2>/dev/null || true
echo "✅ Aplicación detenida"
echo ""

echo "Regenerando Prisma Client..."
npx prisma generate
echo "✅ Prisma Client regenerado"
echo ""

echo "Iniciando aplicación..."
pm2 start src/server.js --name dentali || pm2 restart dentali
pm2 save
echo "✅ Aplicación iniciada"
echo ""

echo "Esperando 3 segundos para que la aplicación inicie..."
sleep 3
pm2 status
echo ""

echo "════════════════════════════════════════════════════════════"
echo "PASO 7: Verificando logs recientes"
echo "════════════════════════════════════════════════════════════"
pm2 logs dentali --lines 20 --nostream
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ CORRECCIÓN COMPLETADA"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Resumen de cambios:"
echo "   - SESSION_SECRET verificado/actualizado"
echo "   - USE_SECURE_COOKIES configurado para HTTP"
echo "   - Dependencias verificadas"
echo "   - Prisma Client regenerado"
echo "   - Aplicación reiniciada"
echo ""
echo "🔍 Próximos pasos:"
echo "   1. Verifica los logs: pm2 logs dentali --lines 50"
echo "   2. Prueba acceder a: http://147.93.118.121:3005/login"
echo "   3. Si aún no funciona, verifica:"
echo "      - Que el puerto 3005 esté abierto: sudo ufw allow 3005"
echo "      - Que no haya errores en los logs"
echo "      - Que haya usuarios en la base de datos"
echo ""
echo "💡 Si no hay usuarios, ejecuta:"
echo "   node prisma/seed.js"
echo ""
EOF

echo ""
echo "✅ Proceso completado"
echo ""
echo "📝 Notas importantes:"
echo "   - Si usas HTTPS, cambia USE_SECURE_COOKIES=true en .env"
echo "   - Si usas Nginx, asegúrate de tener los headers de proxy configurados"
echo "   - Verifica que el puerto 3005 esté abierto en el firewall"
echo ""

