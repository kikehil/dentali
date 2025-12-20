# 🔐 Solución de Problemas de Login en VPS

Este documento explica los problemas más comunes con el login en VPS y cómo solucionarlos.

## 🔍 Problemas Comunes

### 1. **Cookies No Se Guardan (Problema Más Común)**

**Síntoma:** El login parece funcionar pero inmediatamente te redirige al login otra vez.

**Causa:** Las cookies de sesión no se están guardando o enviando correctamente.

**Soluciones:**

#### A. Verificar `USE_SECURE_COOKIES`

Si no tienes HTTPS configurado, las cookies seguras no funcionarán.

```bash
# En el VPS, edita el archivo .env
nano /var/www/html/dentali/.env

# Asegúrate de tener esta línea (o agrégalo):
USE_SECURE_COOKIES=false
```

#### B. Verificar `SESSION_SECRET`

El `SESSION_SECRET` debe ser una cadena aleatoria segura.

```bash
# Generar un nuevo secret
openssl rand -base64 32

# Agregar al .env
SESSION_SECRET=tu_secret_generado_aqui
```

#### C. Verificar Configuración de Nginx (si usas proxy reverso)

Si usas Nginx como proxy reverso, asegúrate de tener estos headers:

```nginx
location / {
    proxy_pass http://localhost:3005;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;  # ← IMPORTANTE
    proxy_cache_bypass $http_upgrade;
}
```

Luego reinicia Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 2. **Error de Conexión a Base de Datos**

**Síntoma:** Error al intentar hacer login, mensaje de error en los logs.

**Solución:**

```bash
# Verificar que MySQL está corriendo
sudo systemctl status mysql

# Verificar la DATABASE_URL en .env
cat /var/www/html/dentali/.env | grep DATABASE_URL

# Probar conexión manual
mysql -u tu_usuario -p tu_base_datos
```

**Formato correcto de DATABASE_URL:**
```
DATABASE_URL="mysql://usuario:password@localhost:3306/nombre_base_datos"
```

---

### 3. **No Hay Usuarios en la Base de Datos**

**Síntoma:** No puedes hacer login porque no existen usuarios.

**Solución:**

```bash
cd /var/www/html/dentali
node prisma/seed.js
```

Esto creará usuarios por defecto. Revisa el archivo `prisma/seed.js` para ver las credenciales.

---

### 4. **Prisma Client No Generado**

**Síntoma:** Errores relacionados con Prisma al intentar hacer login.

**Solución:**

```bash
cd /var/www/html/dentali
npx prisma generate
pm2 restart dentali
```

---

### 5. **Puerto No Abierto en Firewall**

**Síntoma:** No puedes acceder a la aplicación desde fuera del VPS.

**Solución:**

```bash
# Permitir el puerto (por defecto 3005)
sudo ufw allow 3005/tcp

# Verificar estado
sudo ufw status
```

---

## 🚀 Solución Rápida (Script Automático)

### Opción 1: Desde tu máquina local

```bash
# Dar permisos de ejecución
chmod +x fix-login-vps-completo.sh

# Ejecutar (ajusta las variables REMOTE_USER, REMOTE_HOST si es necesario)
./fix-login-vps-completo.sh
```

### Opción 2: Directamente en el VPS

```bash
# Subir el script de diagnóstico al VPS
scp diagnostico-login-vps.sh root@tu_vps:/var/www/html/dentali/

# Conectarte al VPS
ssh root@tu_vps

# Ejecutar diagnóstico
cd /var/www/html/dentali
chmod +x diagnostico-login-vps.sh
./diagnostico-login-vps.sh
```

---

## 📋 Checklist de Verificación

Usa este checklist para verificar que todo está correcto:

- [ ] Archivo `.env` existe y tiene todas las variables necesarias
- [ ] `SESSION_SECRET` está configurado (no es el valor por defecto)
- [ ] `USE_SECURE_COOKIES=false` (si no tienes HTTPS)
- [ ] `DATABASE_URL` es correcta y la base de datos existe
- [ ] MySQL está corriendo: `sudo systemctl status mysql`
- [ ] Hay usuarios en la base de datos
- [ ] Prisma Client está generado: `npx prisma generate`
- [ ] Dependencias instaladas: `npm ci --production`
- [ ] Aplicación corriendo en PM2: `pm2 status`
- [ ] Puerto abierto en firewall: `sudo ufw allow 3005/tcp`
- [ ] Nginx configurado correctamente (si lo usas)

---

## 🔧 Pasos Manuales de Corrección

Si prefieres hacerlo manualmente:

### Paso 1: Conectarse al VPS

```bash
ssh root@tu_ip_vps
cd /var/www/html/dentali
```

### Paso 2: Verificar y corregir .env

```bash
nano .env
```

Asegúrate de tener:

```env
PORT=3005
NODE_ENV=production
DATABASE_URL="mysql://usuario:password@localhost:3306/nombre_db"
SESSION_SECRET="tu_secret_aleatorio_seguro"
USE_SECURE_COOKIES=false
TZ=America/Mexico_City
```

### Paso 3: Regenerar Prisma Client

```bash
npx prisma generate
```

### Paso 4: Verificar dependencias

```bash
npm ci --production
```

### Paso 5: Reiniciar aplicación

```bash
pm2 restart dentali
# O si no está corriendo:
pm2 start src/server.js --name dentali
pm2 save
```

### Paso 6: Verificar logs

```bash
pm2 logs dentali --lines 50
```

---

## 🐛 Debugging Avanzado

### Ver logs en tiempo real

```bash
pm2 logs dentali
```

### Verificar que las cookies se están enviando

En el navegador, abre las herramientas de desarrollador (F12):
1. Ve a la pestaña **Network**
2. Intenta hacer login
3. Busca la petición POST a `/login`
4. Ve a la pestaña **Headers** → **Response Headers**
5. Debe haber un header `Set-Cookie` con `connect.sid`

### Verificar sesión en el servidor

Puedes agregar logs temporales en `src/controllers/authController.js`:

```javascript
// Después de crear la sesión
req.session.user = { ... };
console.log('Sesión creada:', req.session.user);
console.log('Session ID:', req.sessionID);
```

---

## 📞 Si Nada Funciona

1. **Revisa los logs completos:**
   ```bash
   pm2 logs dentali --lines 100
   ```

2. **Verifica que la aplicación está escuchando:**
   ```bash
   curl http://localhost:3005/login
   ```

3. **Prueba hacer login directamente:**
   ```bash
   # Desde el VPS
   curl -X POST http://localhost:3005/login \
     -d "email=tu@email.com&password=tu_password" \
     -c cookies.txt -v
   ```

4. **Verifica la configuración de sesiones en el código:**
   Revisa `src/server.js` líneas 41-52

---

## ✅ Verificación Final

Después de aplicar las correcciones:

1. Accede a: `http://tu_ip_vps:3005/login`
2. Intenta hacer login con credenciales válidas
3. Deberías ser redirigido a `/dashboard`
4. Si recargas la página, deberías permanecer logueado

Si aún no funciona, ejecuta el script de diagnóstico y comparte los resultados.

