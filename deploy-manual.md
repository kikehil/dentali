# Guía de Despliegue Manual al VPS

## Opción 1: Usar el Script Automático (Recomendado)

### Desde tu máquina local (Windows):

1. **Asegúrate de tener SSH configurado:**
   ```bash
   # Si usas Git Bash o WSL
   ssh root@147.93.118.121
   ```

2. **Ejecuta el script de deploy:**
   ```bash
   chmod +x deploy-vps.sh
   ./deploy-vps.sh
   ```

3. **El script te pedirá:**
   - Confirmar conexión SSH
   - Si quieres subir el archivo .env
   - Y ejecutará todo automáticamente

---

## Opción 2: Despliegue Manual Paso a Paso

### Paso 1: Conectarse al VPS
```bash
ssh root@147.93.118.121
# Contraseña: Netbios+2025
```

### Paso 2: Hacer Backup (IMPORTANTE)
```bash
cd /var/www/html
# Crear backup del proyecto actual
tar -czf dentali-backup-$(date +%Y%m%d-%H%M%S).tar.gz dentali/
```

### Paso 3: Ir al directorio del proyecto
```bash
cd /var/www/html/dentali
```

### Paso 4: Detener la aplicación (si está corriendo)
```bash
# Si usas PM2
pm2 stop dentali

# O si usas systemd
systemctl stop dentali

# O si está corriendo directamente
pkill -f "node src/server.js"
```

### Paso 5: Actualizar el código

**Opción A: Si usas Git (recomendado)**
```bash
git pull origin main
# o
git pull origin master
```

**Opción B: Si subes archivos manualmente**
Desde tu máquina local, usa SCP o SFTP para subir los archivos modificados:
```bash
# Desde tu máquina local (Git Bash o PowerShell)
scp -r src/views/cortes/ver.ejs root@147.93.118.121:/var/www/html/dentali/src/views/cortes/
```

### Paso 6: Instalar dependencias (si hay cambios)
```bash
npm install
# o para producción
npm ci --production
```

### Paso 7: Generar Prisma Client
```bash
npx prisma generate
```

### Paso 8: Ejecutar migraciones de base de datos
```bash
npx prisma migrate deploy
```

### Paso 9: Compilar CSS de Tailwind
```bash
npm run build
```

### Paso 10: Reiniciar la aplicación
```bash
# Si usas PM2
pm2 restart dentali
pm2 save

# O si usas systemd
systemctl restart dentali

# O iniciar manualmente
npm start
```

### Paso 11: Verificar que funciona
```bash
# Ver logs
pm2 logs dentali

# O verificar el proceso
pm2 status
```

---

## Opción 3: Script Rápido de Actualización (Solo archivos modificados)

Crea un archivo `update.sh` en el VPS:

```bash
#!/bin/bash
cd /var/www/html/dentali

# Detener aplicación
pm2 stop dentali

# Actualizar código (si usas git)
git pull origin main

# O actualizar solo archivos específicos
# (sube los archivos manualmente antes)

# Regenerar Prisma
npx prisma generate

# Compilar CSS
npm run build

# Reiniciar
pm2 restart dentali

echo "✅ Actualización completada"
```

Luego ejecuta:
```bash
chmod +x update.sh
./update.sh
```

---

## Verificación Post-Despliegue

1. **Verificar que la aplicación está corriendo:**
   ```bash
   pm2 status
   # o
   ps aux | grep node
   ```

2. **Ver logs en tiempo real:**
   ```bash
   pm2 logs dentali --lines 50
   ```

3. **Probar la aplicación:**
   - Abre tu navegador y ve a: `http://147.93.118.121:PUERTO`
   - Verifica que el reporte de corte se vea correctamente

4. **Si hay errores:**
   ```bash
   # Ver logs detallados
   pm2 logs dentali
   
   # Verificar variables de entorno
   cat .env
   
   # Verificar conexión a base de datos
   npx prisma db pull
   ```

---

## Configuración de PM2 (Si no lo tienes)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicación
cd /var/www/html/dentali
pm2 start src/server.js --name dentali

# Guardar configuración
pm2 save

# Configurar para iniciar al arrancar el servidor
pm2 startup
# (sigue las instrucciones que aparecen)
```

---

## Notas Importantes

1. **Siempre haz backup antes de actualizar**
2. **Verifica el archivo .env** tiene las configuraciones correctas
3. **Asegúrate de que la base de datos esté accesible**
4. **Si cambias dependencias**, ejecuta `npm install`
5. **Si cambias el schema de Prisma**, ejecuta migraciones

---

## Solución de Problemas

### Error: "Cannot find module"
```bash
rm -rf node_modules
npm install
npx prisma generate
```

### Error: "Prisma Client not generated"
```bash
npx prisma generate
```

### Error: "Database connection failed"
- Verifica el archivo `.env`
- Verifica que MySQL esté corriendo: `systemctl status mysql`
- Prueba la conexión: `mysql -u root -p`

### Error: "Port already in use"
```bash
# Ver qué proceso usa el puerto
lsof -i :PUERTO
# O
netstat -tulpn | grep :PUERTO
# Matar el proceso si es necesario
kill -9 PID
```






