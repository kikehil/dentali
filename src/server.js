require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const moment = require('moment-timezone');

const config = require('./config/config');
const routes = require('./routes');

const app = express();

// Trust proxy para Railway/Heroku (HTTPS)
app.set('trust proxy', 1);

// Configurar zona horaria
moment.tz.setDefault(config.timezone);

// Configurar locale español
require('moment/locale/es');
moment.locale('es');

// Configurar motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', require('ejs').renderFile);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configurar sesiones
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
  },
}));

// Variables globales para vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.moment = moment;
  res.locals.config = config;
  res.locals.currentPath = req.path;
  // Función helper para obtener hora actual en zona horaria correcta
  // Convierte explícitamente la hora del servidor a la zona horaria configurada
  res.locals.now = () => moment.tz(new Date(), config.timezone);
  next();
});

// Rutas
app.use('/', routes);

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    message: 'La página que buscas no existe',
    error: { status: 404 },
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: err.message || 'Ha ocurrido un error',
    error: config.nodeEnv === 'development' ? err : {},
  });
});

// Iniciar servidor
const PORT = config.port;
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║       🦷 SISTEMA DE CLÍNICA DENTAL MULTI-DOCTOR 🦷        ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Servidor iniciado en: http://localhost:${PORT}`);
  console.log(`📅 Zona horaria: ${config.timezone}`);
  console.log(`🔧 Modo: ${config.nodeEnv}`);
  if (config.n8nWebhookUrl) {
    console.log(`🔗 Webhook n8n: ${config.n8nWebhookUrl}`);
  }
  console.log('');
});

module.exports = app;

