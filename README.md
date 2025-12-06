# Sistema de Gestión Clínica Dental

Sistema de gestión completo para clínica dental multi-doctor.

## Características

- Punto de Venta (POS)
- Gestión de Pacientes
- Gestión de Doctores
- Historial de Ventas
- Cortes de Caja
- Gestión de Gastos
- Configuración de Cortes y Tipo de Cambio

## Requisitos

- Node.js 18+
- MySQL 8+
- npm o yarn

## Instalación Local

```bash
# Instalar dependencias
npm install

# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate deploy

# (Opcional) Ejecutar seed
npm run seed

# Compilar CSS
npm run build

# Iniciar servidor
npm start
```

## Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
PORT=3005
NODE_ENV=development
SESSION_SECRET=tu_secret_key_aqui
DATABASE_URL=mysql://usuario:password@localhost:3306/clinica_dental
TZ=America/Mexico_City
```

## Despliegue en Railway

1. Conecta tu repositorio a Railway
2. Agrega las variables de entorno en Railway:
   - `DATABASE_URL` (Railway puede crear una base de datos MySQL automáticamente)
   - `SESSION_SECRET` (genera una clave secreta segura)
   - `NODE_ENV=production`
   - `TZ=America/Mexico_City`
3. Railway ejecutará automáticamente:
   - `npm install`
   - `npm run build` (compila CSS y genera Prisma)
   - `npx prisma migrate deploy` (aplica migraciones)
   - `npm start` (inicia el servidor)

## Estructura del Proyecto

```
├── prisma/
│   ├── schema.prisma       # Esquema de base de datos
│   └── migrations/         # Migraciones de Prisma
├── src/
│   ├── config/             # Configuración
│   ├── controllers/        # Controladores
│   ├── middleware/         # Middlewares
│   ├── routes/             # Rutas
│   ├── views/              # Vistas EJS
│   ├── public/             # Archivos estáticos
│   └── server.js           # Servidor principal
└── package.json
```

## Tecnologías

- Express.js
- Prisma ORM
- MySQL
- EJS
- Tailwind CSS
- PDFKit
