const mysql = require('mysql2/promise');
require('dotenv').config();

async function applyMigration() {
  let connection;
  
  try {
    // Crear conexión
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'clinica_dental',
      multipleStatements: true
    });

    console.log('Conectado a la base de datos...');

    // Leer el archivo de migración
    const fs = require('fs');
    const path = require('path');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/20251216000000_add_categorias/migration.sql'),
      'utf8'
    );

    // Ejecutar la migración
    console.log('Ejecutando migración...');
    await connection.query(migrationSQL);
    console.log('✓ Migración aplicada exitosamente');

    // Regenerar Prisma Client
    console.log('Regenerando Prisma Client...');
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✓ Prisma Client regenerado');

    console.log('\n¡Migración completada! Reinicia el servidor para aplicar los cambios.');

  } catch (error) {
    console.error('Error al aplicar migración:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('\nAlgunas columnas ya existen. Esto es normal si ya ejecutaste la migración antes.');
      console.log('Intenta regenerar Prisma Client: npx prisma generate');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

applyMigration();




