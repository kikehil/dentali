# 🚀 Inicio Rápido - Despliegue en VPS

## Pasos Rápidos

### 1️⃣ Preparar tu VPS (solo la primera vez)

```bash
# Conectar al servidor
ssh usuario@tu_ip_vps

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar MySQL
sudo apt install mysql-server -y
sudo mysql_secure_installation

# Crear base de datos
sudo mysql -u root -p
# Dentro de MySQL:
CREATE DATABASE dentali CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dentali_user'@'localhost' IDENTIFIED BY 'tu_password';
GRANT ALL PRIVILEGES ON dentali.* TO 'dentali_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Instalar PM2
sudo npm install -g pm2
```

### 2️⃣ Configurar el script de despliegue

**En Windows:**
Edita `deploy-vps.bat` y cambia:
- `DEPLOY_USER=tu_usuario` → tu usuario SSH
- `DEPLOY_HOST=tu_ip_vps` → IP de tu VPS
- `DEPLOY_PATH=/var/www/dentali` → ruta donde quieres el proyecto

**En Linux/Mac:**
Edita `deploy-vps.sh` y cambia las variables al inicio del archivo.

### 3️⃣ Crear archivo .env local

Copia `env.example.txt` como `.env` y configura:
- `DATABASE_URL` con tus credenciales de MySQL
- `SESSION_SECRET` (genera con: `openssl rand -base64 32`)
- `PORT=3005`
- `NODE_ENV=production`

### 4️⃣ Ejecutar despliegue

**En Windows:**
```cmd
deploy-vps.bat
```

**En Linux/Mac:**
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### 5️⃣ Configurar en el servidor

Después del despliegue, conecta al servidor:

```bash
ssh usuario@tu_ip_vps
cd /var/www/dentali
```

Crea el archivo `.env` (copia el contenido de tu `.env` local):

```bash
nano .env
```

Instala y configura:

```bash
npm ci --production
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Sigue las instrucciones que muestre
```

### 6️⃣ Verificar

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs dentali

# Probar
curl http://localhost:3005
```

## ✅ ¡Listo!

Tu aplicación debería estar corriendo en `http://tu-ip-vps:3005`

## 📚 Documentación Completa

Para más detalles, consulta: `GUIA_DESPLIEGUE_VPS.md`

## 🔧 Comandos Útiles

```bash
# Reiniciar aplicación
pm2 restart dentali

# Ver logs
pm2 logs dentali

# Detener aplicación
pm2 stop dentali

# Actualizar aplicación
# 1. Ejecutar deploy-vps.sh/bat de nuevo
# 2. En servidor:
cd /var/www/dentali
npm ci --production
npx prisma migrate deploy
npm run build
pm2 restart dentali
```













