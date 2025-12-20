#!/bin/bash
# Script para verificar y configurar Nginx para el subdominio

echo "🔍 Verificando configuraciones de Nginx existentes..."
echo ""

# Verificar si Nginx está instalado
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx no está instalado"
    echo "Instala con: sudo apt install nginx -y"
    exit 1
fi

echo "✅ Nginx está instalado"
echo ""

# Listar sitios disponibles
echo "📁 Sitios disponibles en /etc/nginx/sites-available:"
ls -la /etc/nginx/sites-available/ | grep -v "^d" | grep -v "total"
echo ""

# Listar sitios habilitados
echo "🔗 Sitios habilitados en /etc/nginx/sites-enabled:"
ls -la /etc/nginx/sites-enabled/ | grep -v "^d" | grep -v "total"
echo ""

# Verificar si existe configuración de dentali
if [ -f /etc/nginx/sites-available/dentali ]; then
    echo "✅ Existe configuración en /etc/nginx/sites-available/dentali"
    echo "📄 Contenido:"
    cat /etc/nginx/sites-available/dentali
    echo ""
else
    echo "❌ No existe configuración para dentali"
fi

# Verificar si está habilitado
if [ -L /etc/nginx/sites-enabled/dentali ]; then
    echo "✅ El sitio dentali está habilitado"
else
    echo "❌ El sitio dentali NO está habilitado"
fi

# Verificar estado de Nginx
echo ""
echo "📊 Estado de Nginx:"
sudo systemctl status nginx --no-pager | head -10

# Verificar configuración de Nginx
echo ""
echo "🔧 Verificando sintaxis de Nginx:"
sudo nginx -t

echo ""
echo "✅ Verificación completada"













