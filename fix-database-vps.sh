#!/bin/bash

# Script para corregir la base de datos en el VPS
# Agrega las columnas faltantes de transferencia por banco
# Uso: ./fix-database-vps.sh

REMOTE_USER="root"
REMOTE_HOST="147.93.118.121"
REMOTE_PATH="/var/www/html/dentali"

echo "🔧 Corrigiendo base de datos en el VPS..."
echo ""

ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/dentali

echo "1. Deteniendo aplicación..."
pm2 stop dentali || true
echo "✅ Aplicación detenida"
echo ""

echo "2. Ejecutando migraciones pendientes..."
npx prisma migrate deploy
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
    echo "⚠️  Error al ejecutar migraciones, intentando solución manual..."
    echo ""
    
    # Intentar agregar las columnas manualmente si no existen
    echo "3. Verificando y agregando columnas faltantes manualmente..."
    node -e "
    require('dotenv').config();
    const mysql = require('mysql2/promise');
    
    async function fixDatabase() {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        
        try {
            // Verificar si las columnas existen
            const [columns] = await connection.execute(
                'SHOW COLUMNS FROM cortes_caja LIKE \"saldoFinalTransferenciaAzteca\"'
            );
            
            if (columns.length === 0) {
                console.log('Agregando columnas faltantes...');
                await connection.execute(\`
                    ALTER TABLE cortes_caja
                    ADD COLUMN saldoFinalTransferenciaAzteca DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferencia,
                    ADD COLUMN saldoFinalTransferenciaBbva DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferenciaAzteca,
                    ADD COLUMN saldoFinalTransferenciaMp DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferenciaBbva
                \`);
                console.log('✅ Columnas agregadas correctamente');
            } else {
                console.log('✅ Las columnas ya existen');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        } finally {
            await connection.end();
        }
    }
    
    fixDatabase().catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
    " 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Columnas agregadas manualmente"
    else
        echo "⚠️  No se pudo usar mysql2, intentando con Prisma..."
        # Alternativa: usar Prisma para ejecutar SQL directo
        echo "Ejecutando SQL directo con Prisma..."
        npx prisma db execute --stdin << 'SQL'
ALTER TABLE cortes_caja
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaAzteca DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferencia,
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaBbva DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferenciaAzteca,
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaMp DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER saldoFinalTransferenciaBbva;
SQL
    fi
else
    echo "✅ Migraciones ejecutadas correctamente"
fi

echo ""
echo "4. Regenerando Prisma Client..."
npx prisma generate
echo "✅ Prisma Client regenerado"
echo ""

echo "5. Verificando estructura de la tabla..."
node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    try {
        // Intentar una consulta simple que use las nuevas columnas
        const test = await prisma.\$queryRaw\`
            SELECT saldoFinalTransferenciaAzteca, 
                   saldoFinalTransferenciaBbva, 
                   saldoFinalTransferenciaMp 
            FROM cortes_caja 
            LIMIT 1
        \`;
        console.log('✅ Columnas verificadas correctamente');
        await prisma.\$disconnect();
    } catch (error) {
        console.error('❌ Error al verificar:', error.message);
        await prisma.\$disconnect();
        process.exit(1);
    }
}

verify();
" 2>&1

echo ""
echo "6. Reiniciando aplicación..."
pm2 restart dentali || pm2 start src/server.js --name dentali
pm2 save
echo "✅ Aplicación reiniciada"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ CORRECCIÓN DE BASE DE DATOS COMPLETADA"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Verifica los logs con:"
echo "   pm2 logs dentali --lines 20"
echo ""
echo "🌐 Prueba acceder a: http://147.93.118.121:3005/pos"
EOF

echo ""
echo "✅ Proceso completado"






