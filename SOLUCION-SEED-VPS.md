# Solución para el Error de Seed en el VPS

## Problema
La tabla `categorias` no existe en la base de datos porque la migración no se ha aplicado.

## Solución Paso a Paso

### Paso 1: Aplicar las migraciones de Prisma

```bash
cd /var/www/html/dentali

# Aplicar todas las migraciones pendientes
npx prisma migrate deploy
```

Esto creará la tabla `categorias` y cualquier otra tabla/columna faltante.

### Paso 2: Regenerar Prisma Client

```bash
npx prisma generate
```

### Paso 3: Crear las categorías iniciales

```bash
node prisma/seed-categorias.js
```

### Paso 4: Ejecutar el seed principal

```bash
node prisma/seed.js
```

## Si la migración falla

Si `prisma migrate deploy` da error, puedes crear la tabla manualmente:

```bash
# Obtener credenciales de la base de datos
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear tabla categorias manualmente
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  descripcion TEXT,
  color VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

# Agregar columna categoriaId a servicios si no existe
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
ALTER TABLE servicios 
ADD COLUMN IF NOT EXISTS categoriaId INT NULL,
ADD CONSTRAINT fk_servicio_categoria 
  FOREIGN KEY (categoriaId) REFERENCES categorias(id) 
  ON DELETE SET NULL ON UPDATE CASCADE;
SQL
```

**Nota**: Si `IF NOT EXISTS` no funciona en tu versión de MySQL, usa este script alternativo:

```bash
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
SET @dbname = DATABASE();
SET @tablename = 'categorias';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
   WHERE table_schema = @dbname AND table_name = @tablename) > 0,
  "SELECT 'Table exists';",
  CONCAT("CREATE TABLE ", @tablename, " (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    descripcion TEXT,
    color VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;")
));
PREPARE createIfNotExists FROM @preparedStatement;
EXECUTE createIfNotExists;
DEALLOCATE PREPARE createIfNotExists;
SQL
```

## Comandos Completos (Todo en uno)

```bash
cd /var/www/html/dentali

# 1. Aplicar migraciones
npx prisma migrate deploy

# 2. Regenerar Prisma Client
npx prisma generate

# 3. Crear categorías
node prisma/seed-categorias.js

# 4. Ejecutar seed principal
node prisma/seed.js

# 5. Reiniciar aplicación
pm2 restart dentali
```

## Verificación

Después de ejecutar los comandos:

```bash
# Verificar que las categorías se crearon
npx prisma studio
# O verificar directamente en la base de datos
```




