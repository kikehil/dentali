#!/bin/bash

# Script para verificar y corregir schema en VPS
# Ejecutar en el VPS

cd /var/www/html/dentali

echo "🔍 Verificando schema.prisma..."
echo ""

# Ver modelo Servicio completo
echo "=== Modelo Servicio completo ==="
sed -n '/^model Servicio {/,/^}/p' prisma/schema.prisma
echo ""

# Verificar si tiene categoriaTexto
echo "=== Buscando categoriaTexto ==="
if grep -q "categoriaTexto" prisma/schema.prisma; then
  echo "❌ ERROR: categoriaTexto encontrado en schema.prisma"
  echo "Líneas:"
  grep -n "categoriaTexto" prisma/schema.prisma
else
  echo "✅ No se encontró categoriaTexto"
fi
echo ""

# Verificar si tiene categoriaId
echo "=== Verificando categoriaId ==="
if grep -q "categoriaId" prisma/schema.prisma; then
  echo "✅ categoriaId encontrado"
  grep -n "categoriaId\|categoria.*Categoria" prisma/schema.prisma | head -3
else
  echo "❌ ERROR: categoriaId NO encontrado"
fi
echo ""

# Verificar Prisma Client
echo "=== Verificando Prisma Client ==="
if [ -d "node_modules/.prisma" ]; then
  echo "✅ Prisma Client existe"
  echo "Última modificación:"
  ls -lh node_modules/.prisma/client/ 2>/dev/null | head -3
else
  echo "⚠️  Prisma Client no encontrado, necesita regenerarse"
fi




