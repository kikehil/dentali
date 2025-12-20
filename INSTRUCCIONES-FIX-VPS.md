# Instrucciones para Corregir Problemas en el VPS

## Problemas Detectados

1. **Error de columna faltante**: `saldoFinalTransferenciaAzteca` no existe en la base de datos
2. **Advertencias de Moment Timezone**: Uso incorrecto de `${config.timezone}` como string literal

## Solución Rápida (Manual)

### Paso 1: Conectarse al VPS

```bash
ssh root@147.93.118.121
# Contraseña: Netbios+2025
cd /var/www/html/dentali
```

### Paso 2: Detener la aplicación

```bash
pm2 stop dentali
```

### Paso 3: Agregar columnas faltantes en la base de datos

```bash
# Obtener credenciales de la base de datos
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

# Extraer información
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Ejecutar SQL para agregar columnas
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
-- Agregar columnas si no existen
ALTER TABLE cortes_caja 
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaAzteca DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaBbva DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS saldoFinalTransferenciaMp DECIMAL(10, 2) NOT NULL DEFAULT 0;
SQL
```

**Nota**: Si `IF NOT EXISTS` no funciona en tu versión de MySQL, usa este script alternativo:

```bash
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
SET @dbname = DATABASE();
SET @tablename = 'cortes_caja';

SET @columnname1 = 'saldoFinalTransferenciaAzteca';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname1) > 0,
  "SELECT 'Column exists';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname1, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname2 = 'saldoFinalTransferenciaBbva';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname2) > 0,
  "SELECT 'Column exists';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname2, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname3 = 'saldoFinalTransferenciaMp';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname3) > 0,
  "SELECT 'Column exists';",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname3, " DECIMAL(10, 2) NOT NULL DEFAULT 0;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
SQL
```

### Paso 4: Regenerar Prisma Client

```bash
npx prisma generate
```

### Paso 5: Actualizar archivos EJS (corrección de timezone)

**Opción A: Si tienes los archivos corregidos localmente, cópialos:**

Desde tu máquina local:
```bash
scp src/views/pos/ventas.ejs root@147.93.118.121:/var/www/html/dentali/src/views/pos/
scp src/views/pos/corte.ejs root@147.93.118.121:/var/www/html/dentali/src/views/pos/
```

**Opción B: Editar directamente en el servidor:**

```bash
# Editar ventas.ejs
nano src/views/pos/ventas.ejs
# Buscar y reemplazar: '${config.timezone}' por config.timezone (sin comillas)

# Editar corte.ejs
nano src/views/pos/corte.ejs
# Buscar y reemplazar: '${config.timezone}' por config.timezone (sin comillas)
```

**Cambios específicos a hacer:**

En `src/views/pos/ventas.ejs`:
- Cambiar: `moment(v.createdAt).tz('${config.timezone}')`
- Por: `moment(v.createdAt).tz(config.timezone)`

En `src/views/pos/corte.ejs`:
- Cambiar: `moment(...).tz('${config.timezone}')`
- Por: `moment(...).tz(config.timezone)`

### Paso 6: Reiniciar la aplicación

```bash
pm2 restart dentali
pm2 save
```

### Paso 7: Verificar

```bash
# Ver logs
pm2 logs dentali --lines 30

# Verificar que no hay errores de timezone
pm2 logs dentali --err | grep -i timezone
```

## Solución Automática (Si tienes sshpass)

Si tienes `sshpass` instalado en tu máquina local:

```bash
chmod +x fix-vps-complete.sh
./fix-vps-complete.sh
```

## Verificación Post-Corrección

1. Los logs no deben mostrar errores de columnas faltantes
2. Los logs no deben mostrar advertencias de "Moment Timezone has no data"
3. La aplicación debe funcionar normalmente
4. Los saldos deben calcularse correctamente

## Si Persisten los Problemas

1. **Verificar migraciones de Prisma:**
   ```bash
   npx prisma migrate status
   ```

2. **Aplicar migraciones manualmente:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Verificar estructura de la tabla:**
   ```bash
   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESCRIBE cortes_caja;"
   ```




