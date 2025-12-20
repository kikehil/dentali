# Mejores Prácticas para Actualizar el VPS

## ⚠️ IMPORTANTE: Prevenir Pérdida de Datos

### Problema Identificado
Al actualizar archivos del local al VPS, se pueden perder datos si:
1. Se ejecuta `seed.js` que borra y recrea datos
2. Se aplican migraciones que eliminan datos
3. Se sobrescriben archivos de configuración importantes

## 🔒 Solución: Sistema de Backup Automático

### 1. Script de Backup (backup-vps.sh)

Este script crea un backup completo antes de actualizar:
- ✅ Backup de la base de datos completa
- ✅ Backup de archivos importantes (.env, schema, código)
- ✅ Guarda backups localmente con timestamp

**Uso:**
```bash
chmod +x backup-vps.sh
./backup-vps.sh
```

### 2. Script de Deploy Seguro (deploy-vps-seguro.sh)

Este script:
1. Crea backup automático
2. Solo actualiza código (NO datos)
3. NO ejecuta seed.js
4. Aplica migraciones de forma segura

**Uso:**
```bash
chmod +x deploy-vps-seguro.sh
./deploy-vps-seguro.sh
```

### 3. Script de Restauración (restaurar-backup-vps.sh)

Si algo sale mal, restaura desde un backup:
```bash
chmod +x restaurar-backup-vps.sh
./restaurar-backup-vps.sh 20251216_231500
```

## 📋 Checklist Antes de Actualizar

### ✅ ANTES de copiar archivos:

1. **Crear backup:**
   ```bash
   ./backup-vps.sh
   ```

2. **Verificar qué archivos se van a actualizar:**
   - Solo código fuente (src/, prisma/schema.prisma)
   - NO archivos de datos
   - NO .env (a menos que sea necesario)

3. **Verificar que NO se ejecutará seed.js:**
   - El seed.js borra y recrea datos
   - Solo ejecutarlo en desarrollo o cuando quieras datos de prueba

### ✅ Archivos que NUNCA debes sobrescribir sin backup:

- `.env` (configuración del servidor)
- Base de datos (siempre hacer backup primero)
- `prisma/migrations/` (solo agregar nuevas, no eliminar)

### ✅ Archivos seguros para actualizar:

- `src/controllers/`
- `src/routes/`
- `src/views/`
- `src/middleware/`
- `src/server.js`
- `prisma/schema.prisma` (pero aplicar migraciones después)

## 🚨 Qué Hacer si Perdiste Datos

### Opción 1: Restaurar desde Backup

```bash
# Ver backups disponibles
ls -lh backups/

# Restaurar un backup específico
./restaurar-backup-vps.sh [timestamp]
```

### Opción 2: Restaurar Manualmente

```bash
# En el VPS
cd /var/www/html/dentali

# Restaurar BD desde backup
mysql -u usuario -p nombre_bd < backup.sql

# Restaurar archivos
tar -xzf files_backup.tar.gz
```

## 🔧 Configuración Recomendada

### 1. Hacer Backup Automático Diario

Agregar a crontab del VPS:
```bash
# Backup diario a las 2 AM
0 2 * * * /var/www/html/dentali/scripts/backup-daily.sh
```

### 2. Mantener Múltiples Backups

```bash
# Mantener últimos 7 días de backups
find backups/ -name "*.sql" -mtime +7 -delete
```

### 3. Verificar Backups Regularmente

```bash
# Verificar que los backups sean válidos
mysql -u usuario -p nombre_bd < backup.sql --dry-run
```

## 📝 Proceso Recomendado para Actualizar

```bash
# 1. Crear backup
./backup-vps.sh

# 2. Actualizar código (usando script seguro)
./deploy-vps-seguro.sh

# 3. Verificar que todo funciona
# - Probar login
# - Verificar datos existentes
# - Probar funcionalidades principales

# 4. Si algo falla, restaurar
./restaurar-backup-vps.sh [timestamp]
```

## ⚠️ ADVERTENCIAS

1. **NUNCA ejecutes `node prisma/seed.js` en producción** sin hacer backup primero
2. **NUNCA elimines migraciones** que ya se aplicaron
3. **Siempre verifica** qué archivos vas a copiar antes de hacerlo
4. **Mantén backups** de al menos los últimos 7 días

## 🔍 Verificar Datos Antes/Después

```bash
# En el VPS, verificar cantidad de registros
mysql -u usuario -p nombre_bd -e "
  SELECT 'Ventas' as tabla, COUNT(*) as registros FROM ventas
  UNION ALL SELECT 'Pacientes', COUNT(*) FROM pacientes
  UNION ALL SELECT 'Servicios', COUNT(*) FROM servicios
  UNION ALL SELECT 'Cortes', COUNT(*) FROM cortes_caja;
"
```




