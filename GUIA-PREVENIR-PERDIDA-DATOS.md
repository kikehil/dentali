# Guía para Prevenir Pérdida de Datos al Actualizar VPS

## 🚨 Problema Identificado

Al actualizar archivos del local al VPS, se pueden perder datos si:
1. Se ejecuta `prisma/seed.js` que **BORRA TODOS LOS DATOS** y los recrea
2. Se aplican migraciones incorrectas
3. Se sobrescriben archivos de configuración

## ✅ Solución: Sistema de Backup

He creado 3 scripts para proteger tus datos:

### 1. `backup-vps.sh` - Crear Backup

**Antes de CUALQUIER actualización**, ejecuta:
```bash
chmod +x backup-vps.sh
./backup-vps.sh
```

Esto crea:
- ✅ Backup completo de la base de datos
- ✅ Backup de archivos importantes
- ✅ Guarda en carpeta `./backups/` con timestamp

### 2. `deploy-vps-seguro.sh` - Actualizar de Forma Segura

**Usa este script en lugar de copiar archivos manualmente:**
```bash
chmod +x deploy-vps-seguro.sh
./deploy-vps-seguro.sh
```

Este script:
- ✅ Crea backup automático antes de actualizar
- ✅ Solo actualiza código (NO datos)
- ✅ NO ejecuta seed.js
- ✅ Aplica migraciones de forma segura

### 3. `restaurar-backup-vps.sh` - Restaurar si Algo Sale Mal

Si perdiste datos, restaura desde backup:
```bash
chmod +x restaurar-backup-vps.sh
./restaurar-backup-vps.sh 20251216_231500
```

## ⚠️ ADVERTENCIAS IMPORTANTES

### ❌ NUNCA ejecutes esto en producción sin backup:

```bash
# ESTO BORRA TODOS LOS DATOS
node prisma/seed.js
```

El `seed.js` tiene estas líneas que **BORRAN TODO**:
```javascript
await prisma.ventaItem.deleteMany();
await prisma.venta.deleteMany();
await prisma.consulta.deleteMany();
// ... etc
```

### ✅ Proceso Seguro para Actualizar:

```bash
# 1. SIEMPRE crear backup primero
./backup-vps.sh

# 2. Actualizar usando script seguro
./deploy-vps-seguro.sh

# 3. Verificar que los datos siguen ahí
# - Contar registros en BD
# - Probar funcionalidades
```

## 📋 Checklist Antes de Actualizar

- [ ] Crear backup con `./backup-vps.sh`
- [ ] Verificar que el backup se creó correctamente
- [ ] NO ejecutar `node prisma/seed.js` en producción
- [ ] Solo actualizar código, NO datos
- [ ] Verificar que `.env` no se sobrescriba
- [ ] Probar después de actualizar

## 🔧 Configurar Backup Automático Diario

En el VPS, crear script de backup diario:

```bash
cd /var/www/html/dentali
mkdir -p scripts
# Copiar scripts/backup-daily.sh al VPS
chmod +x scripts/backup-daily.sh

# Agregar a crontab (backup diario a las 2 AM)
crontab -e
# Agregar esta línea:
0 2 * * * /var/www/html/dentali/scripts/backup-daily.sh
```

## 🔍 Verificar Datos Antes/Después

```bash
# En el VPS, verificar cantidad de registros
cd /var/www/html/dentali
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
  SELECT 'Ventas' as tabla, COUNT(*) as registros FROM ventas
  UNION ALL SELECT 'Pacientes', COUNT(*) FROM pacientes
  UNION ALL SELECT 'Servicios', COUNT(*) FROM servicios
  UNION ALL SELECT 'Cortes', COUNT(*) FROM cortes_caja
  UNION ALL SELECT 'Gastos', COUNT(*) FROM gastos;
"
```

## 💡 Recomendaciones

1. **Hacer backup ANTES de cada actualización**
2. **Usar `deploy-vps-seguro.sh` en lugar de copiar manualmente**
3. **Nunca ejecutar seed.js en producción**
4. **Mantener backups de los últimos 7 días**
5. **Verificar datos después de cada actualización**




