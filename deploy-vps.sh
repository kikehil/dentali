#!/bin/bash

# Script de despliegue para VPS
# Uso: ./deploy-vps.sh

echo "🚀 Iniciando despliegue a VPS..."

# ============================================
# CONFIGURACIÓN - MODIFICA ESTOS VALORES
# ============================================
REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST:-147.93.118.121}"
REMOTE_PORT="${DEPLOY_PORT:-22}"
REMOTE_PATH="${DEPLOY_PATH:-/var/www/html/dentali}"

# ============================================
# Verificaciones previas
# ============================================
echo "📋 Verificando requisitos..."

# Verificar que existe .env
if [ ! -f .env ]; then
    echo "⚠️  ADVERTENCIA: No se encontró archivo .env"
    echo "   Asegúrate de crear el archivo .env antes de desplegar"
    read -p "¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verificar que Node.js está instalado localmente
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado localmente"
    exit 1
fi

# Verificar conexión SSH
echo "🔌 Verificando conexión SSH..."
if ! ssh -p $REMOTE_PORT -o ConnectTimeout=5 $REMOTE_USER@$REMOTE_HOST exit 2>/dev/null; then
    echo "❌ No se puede conectar al servidor SSH"
    echo "   Verifica: usuario, IP, puerto y que el servidor esté accesible"
    exit 1
fi

echo "✅ Conexión SSH verificada"

# ============================================
# Preparar archivos locales
# ============================================
echo ""
echo "📦 Preparando archivos para despliegue..."

# Compilar CSS de Tailwind
echo "🎨 Compilando CSS de Tailwind..."
npm run build 2>/dev/null || {
    echo "⚠️  No se pudo compilar CSS, continuando..."
}

# ============================================
# Crear estructura en servidor
# ============================================
echo ""
echo "📁 Creando estructura de carpetas en servidor..."
ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST << EOF
    mkdir -p $REMOTE_PATH
    mkdir -p $REMOTE_PATH/uploads
    mkdir -p $REMOTE_PATH/logs
EOF

# ============================================
# Subir archivos
# ============================================
echo ""
echo "📤 Subiendo archivos del proyecto..."

# Archivos de configuración
echo "  → Archivos de configuración..."
scp -P $REMOTE_PORT package.json package-lock.json $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/ 2>/dev/null
scp -P $REMOTE_PORT tailwind.config.js $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/ 2>/dev/null
scp -P $REMOTE_PORT nixpacks.toml $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/ 2>/dev/null 2>/dev/null || true

# Carpeta src
echo "  → Carpeta src/..."
scp -r -P $REMOTE_PORT src $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Carpeta prisma
echo "  → Carpeta prisma/..."
scp -r -P $REMOTE_PORT prisma $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Carpeta uploads (solo estructura si está vacía)
echo "  → Carpeta uploads/..."
ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_PATH/uploads"
if [ "$(ls -A uploads 2>/dev/null)" ]; then
    scp -r -P $REMOTE_PORT uploads/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/uploads/ 2>/dev/null || true
fi

# Archivo .env (solo si existe y el usuario lo permite)
if [ -f .env ]; then
    read -p "¿Subir archivo .env al servidor? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  → Archivo .env..."
        scp -P $REMOTE_PORT .env $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/
    fi
fi

# ============================================
# Instalación en servidor
# ============================================
echo ""
echo "⚙️  Ejecutando instalación en servidor..."
echo ""
echo "⚠️  IMPORTANTE: Asegúrate de tener configurado el archivo .env en el servidor"
echo ""

ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST << EOF
    cd $REMOTE_PATH
    
    echo "📦 Instalando dependencias..."
    npm ci --production
    
    echo "🔧 Generando cliente de Prisma..."
    npx prisma generate
    
    echo "🗄️  Ejecutando migraciones..."
    npx prisma migrate deploy
    
    echo "🌱 Ejecutando seed (si es necesario)..."
    node prisma/seed.js || echo "⚠️  Seed falló o no es necesario"
    
    echo "🎨 Compilando CSS final..."
    npm run build || echo "⚠️  Build falló"
    
    echo ""
    echo "✅ Instalación completada en servidor"
EOF

# ============================================
# Instrucciones finales
# ============================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ DESPLIEGUE COMPLETADO"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 PASOS SIGUIENTES EN EL SERVIDOR:"
echo ""
echo "1. Conectar por SSH:"
echo "   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
echo ""
echo "2. Ir al directorio del proyecto:"
echo "   cd $REMOTE_PATH"
echo ""
echo "3. Verificar/crear archivo .env con:"
echo "   - DATABASE_URL (MySQL)"
echo "   - PORT (puerto del servidor, ej: 3005)"
echo "   - NODE_ENV=production"
echo "   - SESSION_SECRET (cadena aleatoria segura)"
echo "   - TZ (zona horaria, ej: America/Mexico_City)"
echo ""
echo "4. Iniciar aplicación con PM2:"
echo "   pm2 start src/server.js --name dentali"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. (Opcional) Configurar Nginx como reverse proxy"
echo ""
echo "🌐 Tu aplicación debería estar corriendo en:"
echo "   http://$REMOTE_HOST:\$PORT"
echo ""
echo "════════════════════════════════════════════════════════════"

