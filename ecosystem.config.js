// Configuración de PM2 para producción
// Instalar PM2: npm install -g pm2
// Arrancar:     pm2 start ecosystem.config.js --env production
// Ver logs:     pm2 logs gestar-erp
// Estado:       pm2 status
// Reiniciar:    pm2 restart gestar-erp
// Detener:      pm2 stop gestar-erp
// Auto-inicio:  pm2 startup && pm2 save

module.exports = {
  apps: [
    {
      name: 'gestar-erp',
      script: 'src/index.js',

      // Cluster mode: usa todos los núcleos disponibles del servidor
      instances: 'max',
      exec_mode: 'cluster',

      // Reinicio automático si el proceso supera 500 MB de RAM
      max_memory_restart: '500M',

      // Variables de entorno para producción
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Variables de entorno para desarrollo
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Logs
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Esperar señal SIGINT/SIGTERM y dar 10s para cierre limpio
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,

      // Reintentar hasta 10 veces antes de marcar como falla
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
