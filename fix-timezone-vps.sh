#!/bin/bash

# Script para corregir el problema de timezone en el VPS
# Ejecutar en el VPS: bash fix-timezone-vps.sh

cd /var/www/html/dentali

echo "🔧 Corrigiendo archivos EJS..."

# Reemplazar en ventas.ejs
echo "   Corrigiendo ventas.ejs..."
sed -i "s/'\\\${config\.timezone}'/config.timezone/g" src/views/pos/ventas.ejs

# Reemplazar en corte.ejs
echo "   Corrigiendo corte.ejs..."
sed -i "s/'\\\${config\.timezone}'/config.timezone/g" src/views/pos/corte.ejs

# Verificar cambios
echo ""
echo "✅ Verificando cambios..."
echo "   En ventas.ejs:"
grep -n "config.timezone" src/views/pos/ventas.ejs | head -5

echo ""
echo "   En corte.ejs:"
grep -n "config.timezone" src/views/pos/corte.ejs | head -5

echo ""
echo "🔄 Reiniciando aplicación..."
pm2 restart dentali

echo ""
echo "✅ Corrección completada"
echo ""
echo "📋 Verifica los logs (espera unos segundos y ejecuta):"
echo "   pm2 logs dentali --lines 20 --err"




