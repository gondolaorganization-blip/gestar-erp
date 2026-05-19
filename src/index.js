require('dotenv').config();

const { validarEntorno } = require('./config/entorno');
validarEntorno();                           // aborta si faltan variables críticas

const app    = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 3000;

const servidor = app.listen(PORT, () => {
  console.log(`GESTAR ERP corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV}`);
});

// ─── APAGADO LIMPIO ──────────────────────────────────────────────────────────
// Cierra conexiones activas antes de terminar el proceso.
// PM2 / Docker envían SIGTERM al detener el contenedor o reiniciar el proceso.

async function apagar(señal) {
  console.log(`\n[${señal}] Iniciando apagado limpio...`);
  servidor.close(async () => {
    await prisma.$disconnect();
    console.log('Conexiones cerradas. Proceso terminado.');
    process.exit(0);
  });

  // Forzar salida si el cierre tarda más de 10 segundos
  setTimeout(() => {
    console.error('Apagado forzado por timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT',  () => apagar('SIGINT'));

// Capturar excepciones no manejadas para no dejar el proceso en estado inconsistente
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  apagar('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  apagar('unhandledRejection');
});
