#!/bin/bash

# Script para ejecutar DIRECTAMENTE en el VPS
# Conéctate al VPS y ejecuta: bash verificar-en-vps.sh

cd /var/www/html/dentali

echo "🔍 Verificando estado del despliegue..."
echo ""

echo "📁 1. Verificando archivos actualizados..."
echo "Últimos archivos modificados en src/views/configuracion:"
find src/views/configuracion -name "*.ejs" -type f -exec ls -lh {} \; | head -5
echo ""

echo "Verificando si existe usuariosController.js:"
if [ -f "src/controllers/usuariosController.js" ]; then
    echo "✅ EXISTE - Tamaño: $(ls -lh src/controllers/usuariosController.js | awk '{print $5}')"
    echo "   Última modificación: $(stat -c %y src/controllers/usuariosController.js 2>/dev/null || stat -f %Sm src/controllers/usuariosController.js 2>/dev/null)"
else
    echo "❌ NO EXISTE"
fi
echo ""

echo "Verificando si existe init-modulos.js:"
if [ -f "scripts/init-modulos.js" ]; then
    echo "✅ EXISTE"
else
    echo "❌ NO EXISTE"
fi
echo ""

echo "Verificando cambios en configuracion/index.ejs:"
if grep -q "Control de Usuarios" src/views/configuracion/index.ejs 2>/dev/null; then
    echo "✅ Contiene 'Control de Usuarios'"
else
    echo "❌ NO contiene 'Control de Usuarios'"
fi
echo ""

echo "🗄️  2. Verificando base de datos..."
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Verificando tabla modulos:"
MODULOS_COUNT=$(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM modulos;" 2>/dev/null)
if [ -n "$MODULOS_COUNT" ]; then
    echo "✅ Tabla modulos existe - Total: $MODULOS_COUNT módulos"
    echo "   Módulos:"
    mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id, nombre, ruta FROM modulos;" 2>/dev/null
else
    echo "❌ Tabla modulos NO existe o hay error de conexión"
fi
echo ""

echo "Verificando tabla permisos_usuarios:"
PERMISOS_COUNT=$(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM permisos_usuarios;" 2>/dev/null)
if [ -n "$PERMISOS_COUNT" ]; then
    echo "✅ Tabla permisos_usuarios existe - Total: $PERMISOS_COUNT permisos"
else
    echo "❌ Tabla permisos_usuarios NO existe"
fi
echo ""

echo "🔄 3. Verificando migraciones de Prisma..."
echo "Estado de migraciones:"
npx prisma migrate status 2>&1 | head -30
echo ""

echo "📦 4. Verificando aplicación..."
if command -v pm2 &> /dev/null; then
    echo "Estado de PM2:"
    pm2 list | grep dentali || echo "❌ Aplicación no está corriendo"
    echo ""
    echo "Últimas 30 líneas del log:"
    pm2 logs dentali --lines 30 --nostream 2>/dev/null | tail -30 || echo "❌ No se pueden ver logs"
else
    echo "⚠️  PM2 no está instalado"
fi
echo ""

echo "🔍 5. Verificando Prisma Client..."
if [ -d "node_modules/.prisma" ]; then
    echo "✅ Prisma Client generado"
else
    echo "❌ Prisma Client NO generado - Ejecuta: npx prisma generate"
fi
echo ""

echo "✅ Verificación completada"
echo ""
echo "📋 Resumen de acciones si algo falta:"
echo "  1. Si faltan archivos: git pull origin main"
echo "  2. Si faltan tablas: npx prisma migrate deploy"
echo "  3. Si faltan módulos: node scripts/init-modulos.js"
echo "  4. Si Prisma Client no está: npx prisma generate"
echo "  5. Si la app no corre: pm2 restart dentali"

