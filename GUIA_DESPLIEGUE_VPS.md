# 🚀 Guía Completa de Despliegue en VPS

Esta guía te ayudará a desplegar tu aplicación de Clínica Dental en un servidor VPS.

## 📋 Requisitos Previos

### En tu VPS necesitas:
- ✅ Ubuntu 20.04+ o Debian 11+ (recomendado)
- ✅ Node.js 18.x o superior
- ✅ MySQL 8.0 o superior
- ✅ PM2 instalado globalmente
- ✅ Git (opcional, para clonar repositorios)
- ✅ Nginx (opcional, para reverse proxy)

### En tu máquina local:
- ✅ Acceso SSH al VPS
- ✅ Claves SSH configuradas
- ✅ Node.js instalado

---

## ⚡ Si Ya Tienes Todo Configurado

**Si ya tienes instalado:**
- ✅ MySQL con base de datos creada
- ✅ PM2 instalado
- ✅ Nginx instalado
- ✅ Node.js instalado

**Puedes omitir los pasos 1.3, 1.4, 1.5 y 1.6** e ir directamente al **Paso 2: Subir el Proyecto**.

**⚠️ IMPORTANTE:** Si tu base de datos se llama diferente (por ejemplo `clinica_dental` en lugar de `dentali`), asegúrate de ajustar el `DATABASE_URL` en el archivo `.env` del servidor (Paso 3.1).

**Ejemplo si tu BD se llama `clinica_dental`:**
```env
DATABASE_URL="mysql://usuario:password@localhost:3306/clinica_dental"
```

---

## 🔧 Paso 1: Preparar el VPS

### 1.1 Conectar al servidor

```bash
ssh usuario@tu_ip_vps
```

### 1.2 Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Instalar Node.js 18.x

```bash
# Instalar Node.js usando NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 1.4 Instalar MySQL

```bash
# Instalar MySQL
sudo apt install mysql-server -y

# Configurar MySQL (ejecutar y seguir las instrucciones)
sudo mysql_secure_installation

# Crear base de datos
sudo mysql -u root -p
```

Dentro de MySQL:

```sql
CREATE DATABASE dentali CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dentali_user'@'localhost' IDENTIFIED BY 'tu_password_segura';
GRANT ALL PRIVILEGES ON dentali.* TO 'dentali_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 1.5 Instalar PM2

```bash
sudo npm install -g pm2
```

### 1.6 Instalar Nginx (opcional, recomendado)

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 📦 Paso 2: Subir el Proyecto

### Opción A: Usando el script de despliegue (Recomendado)

1. **Configurar variables de entorno en tu máquina local:**

```bash
# En tu máquina local, edita el script o exporta variables
export DEPLOY_USER="tu_usuario_vps"
export DEPLOY_HOST="tu_ip_vps"
export DEPLOY_PORT="22"
export DEPLOY_PATH="/var/www/dentali"
```

2. **Dar permisos de ejecución al script:**

```bash
chmod +x deploy-vps.sh
```

3. **Ejecutar el script:**

```bash
./deploy-vps.sh
```

El script te guiará paso a paso.

### Opción B: Subir manualmente

1. **Crear directorio en el servidor:**

```bash
ssh usuario@tu_ip_vps
sudo mkdir -p /var/www/dentali
sudo chown -R $USER:$USER /var/www/dentali
```

2. **Subir archivos (desde tu máquina local):**

```bash
# Desde tu máquina local
scp -r src prisma package.json package-lock.json tailwind.config.js usuario@tu_ip_vps:/var/www/dentali/
```

3. **O usar Git (si tienes el proyecto en un repositorio):**

```bash
# En el servidor
cd /var/www/dentali
git clone tu_repositorio .
```

---

## ⚙️ Paso 3: Configurar el Proyecto

### 3.1 Crear archivo .env

En el servidor, crea el archivo `.env`:

```bash
cd /var/www/dentali
nano .env
```

Copia el contenido de `env.example.txt` y ajusta los valores:

```env
PORT=3005
NODE_ENV=production
DATABASE_URL="mysql://usuario:password@localhost:3306/clinica_dental"
SESSION_SECRET="genera_una_cadena_aleatoria_segura_aqui"
TZ=America/Mexico_City
```

**⚠️ IMPORTANTE:** Ajusta `DATABASE_URL` con:
- Tu usuario de MySQL
- Tu contraseña de MySQL
- El nombre de tu base de datos (ej: `clinica_dental`, `dentali`, etc.)

**Generar SESSION_SECRET seguro:**

```bash
openssl rand -base64 32
```

### 3.2 Instalar dependencias

```bash
cd /var/www/dentali
npm ci --production
```

### 3.3 Configurar Prisma

```bash
# Generar cliente de Prisma (SIEMPRE necesario)
npx prisma generate

# Ejecutar migraciones (SOLO si las tablas NO están creadas)
npx prisma migrate deploy

# (Opcional) Ejecutar seed (SOLO si la BD está vacía)
node prisma/seed.js
```

**💡 Si ya tienes las tablas creadas y pobladas:**
- ✅ Ejecuta solo `npx prisma generate` (necesario para que Prisma funcione)
- ❌ Omite `npx prisma migrate deploy` (no es necesario)
- ❌ Omite `node prisma/seed.js` (no es necesario)

### 3.4 Compilar CSS

```bash
npm run build
```

### 3.5 Crear carpetas necesarias

```bash
mkdir -p uploads logs
chmod 755 uploads
```

---

## 🚀 Paso 4: Iniciar la Aplicación con PM2

### 4.1 Iniciar con PM2

```bash
cd /var/www/dentali

# Opción 1: Usando el archivo de configuración
pm2 start ecosystem.config.js

# Opción 2: Comando directo
pm2 start src/server.js --name dentali --env production
```

### 4.2 Configurar PM2 para iniciar al arrancar

```bash
# Guardar configuración actual
pm2 save

# Configurar inicio automático
pm2 startup
# Copia y ejecuta el comando que te muestre
```

### 4.3 Comandos útiles de PM2

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs dentali

# Reiniciar
pm2 restart dentali

# Detener
pm2 stop dentali

# Eliminar
pm2 delete dentali

# Monitoreo
pm2 monit
```

---

## 🌐 Paso 5: Configurar Nginx (Opcional pero Recomendado)

### 5.1 Crear configuración de Nginx

```bash
sudo nano /etc/nginx/sites-available/dentali
```

Contenido:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Redirigir a HTTPS (si tienes SSL)
    # return 301 https://$server_name$request_uri;

    # O servir directamente en HTTP
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Archivos estáticos (opcional, para mejor rendimiento)
    location /uploads {
        alias /var/www/dentali/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5.2 Habilitar el sitio

```bash
sudo ln -s /etc/nginx/sites-available/dentali /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.3 Configurar SSL con Let's Encrypt (Recomendado)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática (ya viene configurada)
sudo certbot renew --dry-run
```

---

## 🔒 Paso 6: Configurar Firewall

```bash
# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activar firewall
sudo ufw enable

# Ver estado
sudo ufw status
```

---

## ✅ Paso 7: Verificar el Despliegue

1. **Verificar que la aplicación está corriendo:**

```bash
pm2 status
curl http://localhost:3005
```

2. **Verificar logs:**

```bash
pm2 logs dentali
```

3. **Acceder desde el navegador:**

```
http://tu-ip-vps:3005
# O si configuraste Nginx:
http://tu-dominio.com
```

---

## 🔄 Actualizar la Aplicación

### Usando el script de despliegue:

```bash
./deploy-vps.sh
```

Luego en el servidor:

```bash
cd /var/www/dentali
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart dentali
```

### Manualmente:

1. Subir archivos nuevos
2. En el servidor:
```bash
cd /var/www/dentali
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart dentali
```

---

## 🐛 Solución de Problemas

### La aplicación no inicia

```bash
# Ver logs detallados
pm2 logs dentali --lines 100

# Verificar variables de entorno
pm2 env dentali

# Verificar que el puerto está disponible
sudo netstat -tulpn | grep 3005
```

### Error de conexión a base de datos

```bash
# Verificar que MySQL está corriendo
sudo systemctl status mysql

# Probar conexión
mysql -u dentali_user -p dentali

# Verificar DATABASE_URL en .env
cat .env | grep DATABASE_URL
```

### Error de permisos

```bash
# Dar permisos correctos
sudo chown -R $USER:$USER /var/www/dentali
chmod -R 755 /var/www/dentali
chmod -R 775 /var/www/dentali/uploads
```

### Reiniciar todo

```bash
pm2 restart dentali
sudo systemctl restart nginx
sudo systemctl restart mysql
```

---

## 📊 Monitoreo y Mantenimiento

### Ver uso de recursos

```bash
pm2 monit
htop
```

### Backup de base de datos

```bash
# Crear backup
mysqldump -u dentali_user -p dentali > backup_$(date +%Y%m%d).sql

# Restaurar backup
mysql -u dentali_user -p dentali < backup_20231201.sql
```

### Limpiar logs

```bash
# Limpiar logs de PM2
pm2 flush

# Limpiar logs del sistema
sudo journalctl --vacuum-time=7d
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs: `pm2 logs dentali`
2. Verifica la configuración: `.env`, `ecosystem.config.js`
3. Verifica que todos los servicios están corriendo: MySQL, Nginx, PM2

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando correctamente en tu VPS. 

**URLs de acceso:**
- Directo: `http://tu-ip:3005`
- Con Nginx: `http://tu-dominio.com` o `https://tu-dominio.com`

**Credenciales por defecto:**
- Revisa el archivo `prisma/seed.js` para ver las credenciales iniciales

