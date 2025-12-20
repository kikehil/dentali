#!/bin/bash

# Script de diagnóstico para problemas de login en VPS
# Ejecutar directamente en el VPS: ./diagnostico-login-vps.sh

echo "🔍 DIAGNÓSTICO DE PROBLEMAS DE LOGIN"
echo "════════════════════════════════════════════════════════════"
echo ""

# Cambiar al directorio del proyecto
cd /var/www/html/dentali 2>/dev/null || cd ~/dentali 2>/dev/null || {
    echo "❌ No se encontró el directorio del proyecto"
    echo "   Por favor, ejecuta este script desde el directorio del proyecto"
    exit 1
}

echo "📁 Directorio actual: $(pwd)"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "1. VERIFICANDO ARCHIVO .env"
echo "════════════════════════════════════════════════════════════"
if [ ! -f .env ]; then
    echo "❌ ERROR: Archivo .env no existe"
    echo "   Crea el archivo .env con las variables necesarias"
    exit 1
else
    echo "✅ Archivo .env existe"
    
    # Cargar variables
    source .env 2>/dev/null || true
    
    # Verificar variables críticas
    echo ""
    echo "   Variables críticas:"
    
    if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "tu_secret_key_muy_segura_aqui" ]; then
        echo "   ❌ SESSION_SECRET: No configurado o usa valor por defecto"
    else
        echo "   ✅ SESSION_SECRET: Configurado"
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo "   ❌ DATABASE_URL: No configurado"
    else
        echo "   ✅ DATABASE_URL: Configurado"
        # Ocultar contraseña al mostrar
        DB_DISPLAY=$(echo "$DATABASE_URL" | sed 's/:[^@]*@/:***@/')
        echo "      $DB_DISPLAY"
    fi
    
    if grep -q "USE_SECURE_COOKIES=true" .env; then
        echo "   ⚠️  USE_SECURE_COOKIES: true (solo para HTTPS)"
    else
        echo "   ✅ USE_SECURE_COOKIES: false (correcto para HTTP)"
    fi
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "2. VERIFICANDO CONEXIÓN A BASE DE DATOS"
echo "════════════════════════════════════════════════════════════"
node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
    .then(async () => {
        console.log('✅ Conexión a base de datos: EXITOSA');
        const usuarios = await prisma.usuario.count();
        console.log('📊 Total de usuarios:', usuarios);
        if (usuarios > 0) {
            const usuariosActivos = await prisma.usuario.count({ where: { activo: true } });
            console.log('   Usuarios activos:', usuariosActivos);
        } else {
            console.log('⚠️  No hay usuarios en la base de datos');
            console.log('   Ejecuta: node prisma/seed.js');
        }
        return prisma.\$disconnect();
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err.message);
        process.exit(1);
    });
" 2>&1
echo ""

echo "════════════════════════════════════════════════════════════"
echo "3. VERIFICANDO DEPENDENCIAS"
echo "════════════════════════════════════════════════════════════"
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules no existe"
else
    echo "✅ node_modules existe"
    
    DEPS=("@prisma/client" "bcryptjs" "express-session" "express" "dotenv")
    for dep in "${DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            echo "   ✅ $dep instalado"
        else
            echo "   ❌ $dep NO instalado"
        fi
    done
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "4. VERIFICANDO PRISMA CLIENT"
echo "════════════════════════════════════════════════════════════"
if [ -d "node_modules/.prisma/client" ]; then
    echo "✅ Prisma Client generado"
else
    echo "❌ Prisma Client no generado"
    echo "   Ejecuta: npx prisma generate"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "5. VERIFICANDO ESTADO DE PM2"
echo "════════════════════════════════════════════════════════════"
if command -v pm2 &> /dev/null; then
    pm2 status
    echo ""
    if pm2 list | grep -q "dentali"; then
        echo "✅ Aplicación 'dentali' está corriendo"
        echo ""
        echo "📋 Últimas líneas de log:"
        pm2 logs dentali --lines 10 --nostream
    else
        echo "❌ Aplicación 'dentali' NO está corriendo"
        echo "   Inicia con: pm2 start src/server.js --name dentali"
    fi
else
    echo "⚠️  PM2 no está instalado"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "6. VERIFICANDO PUERTO"
echo "════════════════════════════════════════════════════════════"
PORT=$(grep PORT .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "3005")
echo "Puerto configurado: $PORT"
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo "✅ Puerto $PORT está en uso"
else
    echo "❌ Puerto $PORT NO está en uso"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "7. VERIFICANDO NGINX (si existe)"
echo "════════════════════════════════════════════════════════════"
if [ -f /etc/nginx/sites-available/dentali ] || [ -f /etc/nginx/sites-enabled/dentali ]; then
    echo "✅ Configuración de Nginx encontrada"
    NGINX_FILE=$(ls /etc/nginx/sites-available/dentali /etc/nginx/sites-enabled/dentali 2>/dev/null | head -1)
    if grep -q "X-Forwarded-Proto" "$NGINX_FILE" 2>/dev/null; then
        echo "✅ Headers de proxy configurados"
    else
        echo "⚠️  Faltan headers de proxy en Nginx"
    fi
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx está corriendo"
    else
        echo "❌ Nginx NO está corriendo"
    fi
else
    echo "ℹ️  Nginx no configurado"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "8. VERIFICANDO FIREWALL"
echo "════════════════════════════════════════════════════════════"
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "$PORT/tcp"; then
        echo "✅ Puerto $PORT permitido en firewall"
    else
        echo "⚠️  Puerto $PORT puede no estar permitido en firewall"
        echo "   Ejecuta: sudo ufw allow $PORT/tcp"
    fi
else
    echo "ℹ️  UFW no está instalado o no está activo"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ DIAGNÓSTICO COMPLETADO"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "💡 SOLUCIONES COMUNES:"
echo ""
echo "1. Si SESSION_SECRET no está configurado:"
echo "   openssl rand -base64 32"
echo "   Agrega: SESSION_SECRET=<resultado> a .env"
echo ""
echo "2. Si USE_SECURE_COOKIES está en true (y no tienes HTTPS):"
echo "   Cambia a: USE_SECURE_COOKIES=false en .env"
echo ""
echo "3. Si no hay usuarios en la base de datos:"
echo "   node prisma/seed.js"
echo ""
echo "4. Si Prisma Client no está generado:"
echo "   npx prisma generate"
echo ""
echo "5. Si la aplicación no está corriendo:"
echo "   pm2 start src/server.js --name dentali"
echo "   pm2 save"
echo ""
echo "6. Si el puerto no está abierto:"
echo "   sudo ufw allow $PORT/tcp"
echo ""

