// Script de prueba de envío de correo vía Resend (SMTP).
// Uso:
//   node scripts/test-email.js                 -> envía al email por defecto desde el dominio de prueba
//   node scripts/test-email.js destino@x.com   -> destinatario personalizado
//   FROM_TEST=1 node scripts/test-email.js      -> fuerza remitente onboarding@resend.dev (sin dominio verificado)
//
// Lee la configuración SMTP del .env (SMTP_HOST/PORT/USER/PASS, EMAIL_FROM).

require('dotenv').config();
const nodemailer = require('nodemailer');

const destino = process.argv[2] || 'gondola.organization@gmail.com';
const usarDominioPrueba = process.env.FROM_TEST === '1';
const from = usarDominioPrueba
  ? 'GESTAR ERP (prueba) <onboarding@resend.dev>'
  : (process.env.EMAIL_FROM || 'GESTAR ERP <noreply@gestarsoft.com>');

async function main() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('❌ Faltan variables SMTP en .env (SMTP_HOST / SMTP_USER / SMTP_PASS).');
    process.exit(1);
  }

  console.log(`→ Conectando a ${SMTP_HOST}:${SMTP_PORT} como "${SMTP_USER}"`);
  console.log(`→ Remitente: ${from}`);
  console.log(`→ Destinatario: ${destino}\n`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '465'),
    secure: parseInt(SMTP_PORT ?? '465') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // 1) Verifica credenciales/conexión
  try {
    await transporter.verify();
    console.log('✅ Conexión y credenciales SMTP correctas.\n');
  } catch (err) {
    console.error('❌ Fallo de conexión/credenciales:', err.message);
    process.exit(1);
  }

  // 2) Envía el correo de prueba
  try {
    const info = await transporter.sendMail({
      from,
      to: destino,
      subject: 'Prueba de correo — GESTAR ERP',
      html: '<h2>✅ Funciona</h2><p>Este es un correo de prueba enviado por GESTAR ERP vía Resend.</p>',
    });
    console.log('✅ Correo enviado. ID:', info.messageId);
    console.log('   Revisa la bandeja de entrada (y spam) de', destino);
  } catch (err) {
    console.error('❌ Error al enviar:', err.message);
    if (/domain is not verified|not verified|only send testing/i.test(err.message)) {
      console.error('\n💡 El dominio gestarsoft.com aún no está verificado en Resend.');
      console.error('   Reintenta con el dominio de prueba:  FROM_TEST=1 node scripts/test-email.js');
    }
    process.exit(1);
  }
}

main();
