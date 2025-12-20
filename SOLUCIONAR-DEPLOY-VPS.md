# Solución: Cambios No Aplicados en el VPS

Si el despliegue terminó pero no ves los cambios, sigue estos pasos:

## 🔍 Paso 1: Verificar Estado

**Conéctate al VPS:**
```bash
ssh root@147.93.118.121
```

**Ejecuta el script de verificación:**
```bash
cd /var/www/html/dentali
bash verificar-en-vps.sh
```

O verifica manualmente:

### Verificar Archivos
```bash
cd /var/www/html/dentali

# Verificar si existen los archivos nuevos
ls -la src/controllers/usuariosController.js
ls -la scripts/init-modulos.js
ls -la src/views/configuracion/usuarios/

# Verificar cambios en configuracion/index.ejs
grep -n "Control de Usuarios" src/views/configuracion/index.ejs
```

### Verificar Base de Datos
```bash
# Verificar si existen las tablas
mysql -u [usuario] -p [base_de_datos] -e "SHOW TABLES LIKE 'modulos';"
mysql -u [usuario] -p [base_de_datos] -e "SHOW TABLES LIKE 'permisos_usuarios';"

# Ver módulos existentes
mysql -u [usuario] -p [base_de_datos] -e "SELECT * FROM modulos;"
```

## 🔧 Paso 2: Aplicar Cambios Faltantes

### Si faltan archivos:

```bash
cd /var/www/html/dentali

# Asegúrate de estar en la rama correcta
git status
git branch

# Hacer pull de los cambios
git pull origin main
# o
git pull origin master
```

### Si faltan tablas en la base de datos:

```bash
cd /var/www/html/dentali

# Regenerar Prisma Client
npx prisma generate

# Aplicar migraciones
npx prisma migrate deploy

# Si falla, usar db push
npx prisma db push --accept-data-loss
```

### Si faltan módulos:

```bash
cd /var/www/html/dentali

# Inicializar módulos
node scripts/init-modulos.js

# O crear manualmente
mysql -u [usuario] -p [base_de_datos] << 'SQL'
INSERT IGNORE INTO modulos (nombre, ruta, activo, createdAt, updatedAt) VALUES
('Punto de Venta', '/pos', true, NOW(), NOW()),
('Pacientes', '/pacientes', true, NOW(), NOW()),
('Doctores', '/doctores', true, NOW(), NOW()),
('Historial Ventas', '/pos/ventas', true, NOW(), NOW()),
('Cortes de Caja', '/cortes', true, NOW(), NOW()),
('Gastos', '/gastos', true, NOW(), NOW()),
('Configuración', '/configuracion', true, NOW(), NOW());
SQL
```

### Si la aplicación no muestra cambios:

```bash
cd /var/www/html/dentali

# Reiniciar la aplicación
pm2 restart dentali

# O si no está corriendo
pm2 start ecosystem.config.js
pm2 save

# Ver logs para errores
pm2 logs dentali --lines 50
```

## 🐛 Problemas Comunes

### 1. Git no sincronizó los archivos

**Solución:**
```bash
cd /var/www/html/dentali
git fetch origin
git pull origin main
```

### 2. Migraciones no se aplicaron

**Solución:**
```bash
cd /var/www/html/dentali
npx prisma migrate deploy
# Si falla:
npx prisma db push --accept-data-loss
npx prisma generate
```

### 3. Prisma Client desactualizado

**Solución:**
```bash
cd /var/www/html/dentali
npx prisma generate
pm2 restart dentali
```

### 4. La aplicación tiene caché

**Solución:**
```bash
cd /var/www/html/dentali
pm2 restart dentali
# Limpiar caché del navegador (Ctrl + Shift + R)
```

### 5. Archivos no se subieron al repositorio

**Verificar localmente:**
```bash
# En tu máquina local
git status
git log --oneline -5

# Si faltan archivos, hacer commit y push
git add .
git commit -m "Actualización completa del sistema"
git push origin main
```

## ✅ Checklist de Verificación

- [ ] Archivos nuevos existen en el VPS
- [ ] Tablas `modulos` y `permisos_usuarios` existen
- [ ] Módulos están inicializados en la BD
- [ ] Prisma Client está generado
- [ ] Migraciones aplicadas correctamente
- [ ] Aplicación reiniciada
- [ ] Logs no muestran errores
- [ ] Cambios visibles en el navegador (Ctrl + Shift + R)

## 🔄 Re-despliegue Completo

Si nada funciona, haz un re-despliegue completo:

```bash
# En el VPS
cd /var/www/html/dentali

# 1. Backup
mysqldump -u [usuario] -p [base_de_datos] > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Actualizar código
git fetch origin
git reset --hard origin/main
git pull origin main

# 3. Instalar dependencias
npm install --production

# 4. Aplicar migraciones
npx prisma generate
npx prisma migrate deploy

# 5. Inicializar módulos
node scripts/init-modulos.js

# 6. Reiniciar
pm2 restart dentali
pm2 logs dentali
```

## 📞 Si Persiste el Problema

Comparte:
1. Salida de `bash verificar-en-vps.sh`
2. Salida de `pm2 logs dentali --lines 50`
3. Salida de `npx prisma migrate status`
4. Captura de pantalla del error en el navegador

