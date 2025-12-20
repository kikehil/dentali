#!/bin/bash

# Script para resetear saldos localmente
# Uso: ./reset-saldos-local.sh

echo "🔄 Reseteando saldos en la base de datos LOCAL..."
echo "⚠️  Esto eliminará todos los cortes y saldos iniciales del día actual"
echo ""
read -p "¿Estás seguro de continuar? (s/N): " confirmar

if [[ ! $confirmar =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "📋 Leyendo configuración de base de datos desde .env..."

if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado"
    exit 1
fi

# Obtener DATABASE_URL del .env
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DB_URL" ]; then
    echo "❌ No se encontró DATABASE_URL en .env"
    exit 1
fi

# Extraer información de la conexión
# Formato: mysql://user:password@host:port/database
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_NAME" ]; then
    echo "❌ No se pudo extraer información de DATABASE_URL"
    exit 1
fi

echo "   Base de datos: $DB_NAME"
echo "   Host: $DB_HOST"
echo "   Usuario: $DB_USER"
echo ""

echo "🔧 Ejecutando SQL para resetear saldos..."
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < reset-saldos.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Saldos reseteados correctamente"
    echo ""
    echo "💡 Ahora cuando accedas a /pos, el sistema te pedirá ingresar un saldo inicial"
else
    echo ""
    echo "❌ Error al ejecutar el script SQL"
    exit 1
fi

