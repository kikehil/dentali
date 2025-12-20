# Guía Manual para Actualizar el VPS

## Opción 1: Usando el Script Automático (Recomendado)

Si tienes `sshpass` instalado en tu máquina local:

```bash
chmod +x deploy-vps-update.sh
./deploy-vps-update.sh
```

Si no tienes `sshpass`, instálalo:
- **Windows (Git Bash)**: No disponible, usa la Opción 2
- **Linux/Mac**: `sudo apt-get install sshpass` o `brew install sshpass`

## Opción 2: Actualización Manual (Paso a Paso)

### Paso 1: Conectarse al VPS

```bash
ssh root@147.93.118.121
# Contraseña: Netbios+2025
```

### Paso 2: Navegar al directorio del proyecto

```bash
cd /var/www/html/dentali
```

### Paso 3: Detener la aplicación

```bash
pm2 stop dentali
```

### Paso 4: Crear backup (opcional pero recomendado)

```bash
mkdir -p backups
tar -czf backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz --exclude='node_modules' --exclude='backups' --exclude='.git' .
```

### Paso 5: Actualizar archivos

**Opción A: Si usas Git (recomendado)**
```bash
git pull origin main
# o
git pull origin master
```

**Opción B: Copiar archivos manualmente desde tu máquina local**

Desde tu máquina local (en otra terminal):
```bash
# Copiar archivos específicos
scp src/controllers/posController.js root@147.93.118.121:/var/www/html/dentali/src/controllers/
scp src/controllers/categoriasController.js root@147.93.118.121:/var/www/html/dentali/src/controllers/
scp src/routes/posRoutes.js root@147.93.118.121:/var/www/html/dentali/src/routes/
scp src/routes/categoriasRoutes.js root@147.93.118.121:/var/www/html/dentali/src/routes/
scp src/views/partials/header.ejs root@147.93.118.121:/var/www/html/dentali/src/views/partials/
scp src/views/layout.ejs root@147.93.118.121:/var/www/html/dentali/src/views/
scp src/views/pos/index.ejs root@147.93.118.121:/var/www/html/dentali/src/views/pos/
scp src/views/pos/servicios.ejs root@147.93.118.121:/var/www/html/dentali/src/views/pos/
scp src/views/configuracion/index.ejs root@147.93.118.121:/var/www/html/dentali/src/views/configuracion/
scp -r src/views/categorias root@147.93.118.121:/var/www/html/dentali/src/views/
scp prisma/schema.prisma root@147.93.118.121:/var/www/html/dentali/prisma/
scp -r prisma/migrations root@147.93.118.121:/var/www/html/dentali/prisma/
scp prisma/seed-categorias.js root@147.93.118.121:/var/www/html/dentali/prisma/
scp package.json root@147.93.118.121:/var/www/html/dentali/
```

### Paso 6: Instalar dependencias (si hay nuevas)

```bash
npm install
```

### Paso 7: Aplicar migraciones de base de datos

```bash
npx prisma migrate deploy
```

### Paso 8: Regenerar Prisma Client

```bash
npx prisma generate
```

### Paso 9: Ejecutar seed de categorías

```bash
node prisma/seed-categorias.js
```

Si da error porque las categorías ya existen, es normal, puedes ignorarlo.

### Paso 10: Compilar CSS (Tailwind)

```bash
npx tailwindcss -i ./src/public/css/input.css -o ./src/public/css/output.css --minify
```

### Paso 11: Reiniciar la aplicación

```bash
pm2 restart dentali
# Si no existe, crearlo:
# pm2 start src/server.js --name dentali
pm2 save
```

### Paso 12: Verificar que todo funciona

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs dentali --lines 30

# Verificar que el servidor responde
curl http://localhost:3000
```

## Verificación Post-Despliegue

1. **Verificar que las categorías se crearon:**
   ```bash
   npx prisma studio
   # Abre en el navegador y verifica la tabla "categorias"
   ```

2. **Verificar logs de errores:**
   ```bash
   pm2 logs dentali --err
   ```

3. **Probar en el navegador:**
   - Acceder a la aplicación
   - Verificar que los saldos se muestran en la barra superior
   - Verificar que el botón "Saldos" ya no aparece
   - Probar crear/editar categorías en Configuración
   - Probar el filtro por categoría en el POS

## Solución de Problemas

### Si hay errores en las migraciones:

```bash
# Ver estado de migraciones
npx prisma migrate status

# Si hay problemas, aplicar manualmente
npx prisma migrate resolve --applied <nombre-migracion>
```

### Si Prisma Client no se regenera:

```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Si la aplicación no inicia:

```bash
# Ver logs detallados
pm2 logs dentali --lines 50

# Reiniciar desde cero
pm2 delete dentali
pm2 start src/server.js --name dentali
pm2 save
```

### Si hay problemas de permisos:

```bash
chown -R www-data:www-data /var/www/html/dentali
chmod -R 755 /var/www/html/dentali
```

## Archivos Modificados en esta Actualización

- ✅ `src/controllers/posController.js` - Soporte para categorías
- ✅ `src/controllers/categoriasController.js` - Nuevo controlador
- ✅ `src/routes/posRoutes.js` - Rutas actualizadas
- ✅ `src/routes/categoriasRoutes.js` - Nuevas rutas
- ✅ `src/views/partials/header.ejs` - Botón Saldos eliminado
- ✅ `src/views/layout.ejs` - Funciones de modal eliminadas
- ✅ `src/views/pos/index.ejs` - Pestaña por categoría
- ✅ `src/views/pos/servicios.ejs` - Dropdown de categorías
- ✅ `src/views/configuracion/index.ejs` - Link a categorías
- ✅ `src/views/categorias/` - Nuevas vistas CRUD
- ✅ `prisma/schema.prisma` - Modelo Categoria
- ✅ `prisma/migrations/` - Migración de categorías
- ✅ `prisma/seed-categorias.js` - Seed de categorías iniciales




