// Configuración de PM2 para producción
// Uso: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'dentali',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    
    // Configuración de logs
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Configuración de reinicio
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Configuración de reinicio en caso de error
    min_uptime: '10s',
    max_restarts: 10,
    
    // Configuración de clúster (opcional, descomentar si quieres usar cluster mode)
    // instances: 'max',
    // exec_mode: 'cluster',
    
    // Configuración de merge logs
    merge_logs: true,
    
    // Configuración de entorno
    env_production: {
      NODE_ENV: 'production',
      PORT: 3005
    }
  }]
};













