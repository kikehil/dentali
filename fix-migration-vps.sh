#!/bin/bash

# Script para resolver migración fallida y crear tabla categorias
# Ejecutar en el VPS

cd /var/www/html/dentali

echo "🔧 Resolviendo migración fallida..."

# Obtener credenciales
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📊 Resolviendo migración fallida..."
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
-- Marcar la migración fallida como resuelta
UPDATE _prisma_migrations 
SET finished_at = NOW(), 
    applied_steps_count = 1 
WHERE migration_name = '20251210212941_add_transferencia_banco_saldos' 
  AND finished_at IS NULL;
SQL

echo ""
echo "📁 Creando tabla categorias..."
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
-- Crear tabla categorias
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  descripcion TEXT,
  color VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar columna categoriaId a servicios si no existe
SET @dbname = DATABASE();
SET @tablename = 'servicios';
SET @columnname = 'categoriaId';

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  "SELECT 'Column exists';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " INT NULL;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar foreign key si no existe
SET @fk_name = 'fk_servicio_categoria';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
   WHERE TABLE_SCHEMA = @dbname AND CONSTRAINT_NAME = @fk_name) > 0,
  "SELECT 'FK exists';",
  CONCAT("ALTER TABLE servicios ADD CONSTRAINT ", @fk_name, 
         " FOREIGN KEY (categoriaId) REFERENCES categorias(id) ON DELETE SET NULL ON UPDATE CASCADE;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
SQL

echo ""
echo "✅ Tabla categorias creada"
echo ""
echo "🔄 Regenerando Prisma Client..."
npx prisma generate

echo ""
echo "✅ Proceso completado"
echo ""
echo "Ahora puedes ejecutar:"
echo "  node prisma/seed-categorias.js"
echo "  node prisma/seed.js"




