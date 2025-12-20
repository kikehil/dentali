#!/bin/bash

# Script para actualizar solo el archivo ver.ejs en el VPS
# Uso: ./update-ver-ejs.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"
LOCAL_FILE="src/views/cortes/ver.ejs"
REMOTE_FILE="$REMOTE_PATH/src/views/cortes/ver.ejs"

echo "🚀 Actualizando archivo ver.ejs en el VPS..."
echo ""

# Verificar que el archivo local existe
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Error: No se encontró el archivo $LOCAL_FILE"
    exit 1
fi

# Subir el archivo
echo "📤 Subiendo archivo..."
scp "$LOCAL_FILE" $REMOTE_USER@$REMOTE_HOST:$REMOTE_FILE

if [ $? -eq 0 ]; then
    echo "✅ Archivo subido correctamente"
    echo ""
    echo "🔄 Reiniciando aplicación en el servidor..."
    
    # Reiniciar PM2
    ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && pm2 restart dentali"
    
    if [ $? -eq 0 ]; then
        echo "✅ Aplicación reiniciada"
        echo ""
        echo "🎉 Actualización completada!"
        echo ""
        echo "📋 Verifica los logs con:"
        echo "   ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 logs dentali --lines 20'"
    else
        echo "⚠️  No se pudo reiniciar PM2, pero el archivo se subió correctamente"
        echo "   Reinicia manualmente con: pm2 restart dentali"
    fi
else
    echo "❌ Error al subir el archivo"
    exit 1
fi






