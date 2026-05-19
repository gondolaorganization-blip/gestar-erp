// Valida que todas las variables de entorno críticas estén definidas al arrancar.
// El proceso termina con error claro si falta alguna, en lugar de fallar silenciosamente en runtime.

const REQUERIDAS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PORT',
  'NODE_ENV',
];

function validarEntorno() {
  const faltantes = REQUERIDAS.filter((k) => !process.env[k]);

  if (faltantes.length > 0) {
    console.error('❌  Variables de entorno faltantes:');
    faltantes.forEach((k) => console.error(`    - ${k}`));
    console.error('    Revisa tu archivo .env o las variables del servidor.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌  JWT_SECRET debe tener al menos 32 caracteres en producción.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.includes('secret')) {
    console.error('❌  JWT_SECRET parece ser un valor de desarrollo. Usa un secreto seguro en producción.');
    process.exit(1);
  }
}

module.exports = { validarEntorno };
