# Guía de Despliegue Seguro al VPS

Esta guía te ayudará a actualizar el sistema en tu VPS sin perder datos ni afectar la base de datos existente.

## 📋 Cambios Principales Incluidos

### Nuevas Funcionalidades:
1. **Sistema de Control de Usuarios**
   - Nuevas tablas: `modulos` y `permisos_usuarios`
   - Control de acceso por módulo
   - CRUD de usuarios con permisos

2. **Mejoras en Cortes de Caja**
   - Corte de Efectivo separado
   - Corte de Bancos separado
   - Mejoras en cálculos de saldos

3. **Mejoras en UI/UX**
   - Precios editables en carrito
   - Mejoras en visualización de cortes
   - Correcciones de colores y layout

## 🚀 Opción 1: Despliegue Automático (Recomendado)

### Requisitos Previos:
- Acceso SSH al VPS
- `rsync` instalado localmente
- Claves SSH configuradas

### Pasos:

1. **Editar el script de despliegue:**
```bash
nano deploy-vps-seguro-actualizado.sh
```

2. **Actualizar las variables:**
```bash
VPS_USER="root"  # Tu usuario SSH
VPS_HOST="tu-vps.com"  # Tu IP o dominio
VPS_PATH="/var/www/html/dentali"  # Ruta en el VPS
```

3. **Dar permisos de ejecución:**
```bash
chmod +x deploy-vps-seguro-actualizado.sh
```

4. **Ejecutar el despliegue:**
```bash
./deploy-vps-seguro-actualizado.sh
```

El script:
- ✅ Crea backup automático de la BD
- ✅ Sincroniza solo archivos de código
- ✅ Instala dependencias
- ✅ Aplica migraciones de Prisma
- ✅ Inicializa módulos si no existen
- ✅ Reinicia la aplicación

## 🔧 Opción 2: Despliegue Manual

### Paso 1: Backup de Base de Datos

**En el VPS:**
```bash
cd /var/www/html/dentali

# Obtener credenciales
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear backup
mkdir -p backups
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > backups/backup_$(date +%Y%m%d_%H%M%S).sql

echo "✅ Backup creado"
```

### Paso 2: Sincronizar Archivos

**Desde tu máquina local:**
```bash
rsync -avz --progress \
  --exclude='.env' \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='backups' \
  ./ root@tu-vps.com:/var/www/html/dentali/
```

O usando Git (si tienes repositorio):
```bash
# En el VPS
cd /var/www/html/dentali
git pull origin main
```

### Paso 3: Instalar Dependencias

**En el VPS:**
```bash
cd /var/www/html/dentali
npm install --production
```

### Paso 4: Aplicar Migraciones de Prisma

**En el VPS:**
```bash
cd /var/www/html/dentali

# Regenerar Prisma Client
npx prisma generate

# Aplicar migraciones (solo crea tablas/columnas, no elimina datos)
npx prisma migrate deploy
```

Si `migrate deploy` falla, usar:
```bash
npx prisma db push --accept-data-loss
```

### Paso 5: Inicializar Módulos

**En el VPS:**
```bash
cd /var/www/html/dentali

# Verificar si existen módulos
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear módulos si no existen
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'SQL'
INSERT IGNORE INTO modulos (nombre, ruta, activo, createdAt, updatedAt) VALUES
('Punto de Venta', '/pos', true, NOW(), NOW()),
('Pacientes', '/pacientes', true, NOW(), NOW()),
('Doctores', '/doctores', true, NOW(), NOW()),
('Historial Ventas', '/pos/ventas', true, NOW(), NOW()),
('Cortes de Caja', '/cortes', true, NOW(), NOW()),
('Gastos', '/gastos', true, NOW(), NOW()),
('Configuración', '/configuracion', true, NOW(), NOW());
SQL

# O si existe el script
node scripts/init-modulos.js
```

### Paso 6: Reiniciar Aplicación

**Con PM2:**
```bash
pm2 restart dentali
# o
pm2 start ecosystem.config.js
pm2 save
```

**Con systemd:**
```bash
sudo systemctl restart dentali
```

## ⚠️ Verificaciones Post-Despliegue

1. **Verificar que la aplicación funciona:**
   - Acceder a la URL del VPS
   - Intentar iniciar sesión
   - Verificar que los módulos aparecen correctamente

2. **Verificar base de datos:**
```bash
# En el VPS
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) as modulos FROM modulos;"
```

3. **Verificar logs:**
```bash
# Con PM2
pm2 logs dentali

# Con systemd
sudo journalctl -u dentali -f
```

## 🔄 Restaurar Backup (Si es Necesario)

Si algo sale mal, puedes restaurar el backup:

```bash
cd /var/www/html/dentali

# Obtener credenciales (mismo código de arriba)
# ...

# Restaurar backup
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < backups/backup_YYYYMMDD_HHMMSS.sql
```

## 📝 Notas Importantes

1. **El archivo `.env` NO se sincroniza** - Mantiene la configuración del VPS
2. **Las migraciones solo AGREGAN** - No eliminan datos existentes
3. **Los módulos se crean solo si no existen** - No afecta módulos existentes
4. **Los usuarios existentes mantienen sus datos** - Solo se agregan nuevas funcionalidades

## 🆘 Solución de Problemas

### Error: "Table 'modulos' doesn't exist"
```bash
npx prisma migrate deploy
# o
npx prisma db push
```

### Error: "hasModuleAccess is not defined"
- Verificar que `src/server.js` tiene la función `hasModuleAccess` en `res.locals`
- Reiniciar la aplicación

### Error: "Cannot find module"
```bash
npm install --production
npx prisma generate
```

### La aplicación no inicia
```bash
# Ver logs
pm2 logs dentali
# o
sudo journalctl -u dentali -f

# Verificar variables de entorno
cat .env | grep DATABASE_URL
```

## ✅ Checklist Final

- [ ] Backup de BD creado
- [ ] Archivos sincronizados
- [ ] Dependencias instaladas
- [ ] Migraciones aplicadas
- [ ] Módulos inicializados
- [ ] Aplicación reiniciada
- [ ] Login funciona
- [ ] Módulos visibles en sidebar
- [ ] Control de usuarios accesible
- [ ] Sin errores en logs

