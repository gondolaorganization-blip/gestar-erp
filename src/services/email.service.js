const nodemailer = require('nodemailer');

// Si no hay SMTP configurado, imprime el email en consola (dev/staging)
function crearTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587'),
    secure: parseInt(SMTP_PORT ?? '587') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function enviarEmail({ to, subject, html }) {
  const transporter = crearTransporter();
  const from = process.env.EMAIL_FROM || 'GESTAR ERP <noreply@gestar-erp.com>';

  if (!transporter) {
    console.log(`\n[EMAIL — sin SMTP] Para: ${to}\nAsunto: ${subject}\n${html.replace(/<[^>]+>/g, '')}\n`);
    return;
  }

  await transporter.sendMail({ from, to, subject, html });
}

// ── Templates ─────────────────────────────────────────────────────────────────

function templateBase(titulo, cuerpo) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;margin:0;padding:0}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#0A0D13 0%,#0F2744 100%);padding:28px 32px;text-align:center}
  .logo-box{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4E9AF1,#00C896);display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff;margin-bottom:10px}
  .logo-name{color:#E8EDFF;font-size:16px;font-weight:800;letter-spacing:.02em}
  .logo-sub{color:#4E9AF1;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
  .body{padding:32px}
  h2{color:#1a1a2e;font-size:20px;margin:0 0 16px}
  p{color:#555;font-size:14px;line-height:1.6;margin:0 0 14px}
  .btn{display:inline-block;background:#4E9AF1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;margin:8px 0}
  .info-box{background:#f8f9fc;border-radius:8px;padding:16px 20px;margin:16px 0}
  .info-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #eee}
  .info-row:last-child{border-bottom:none}
  .info-label{color:#888}
  .info-val{color:#1a1a2e;font-weight:600}
  .footer{background:#f4f6f9;padding:16px 32px;text-align:center;font-size:11px;color:#aaa}
  .token-box{background:#f0f7ff;border:1px solid #c3ddf9;border-radius:8px;padding:16px;text-align:center;margin:16px 0;word-break:break-all;font-family:monospace;font-size:14px;color:#1a5fa8}
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo-box">G</div><br>
      <div class="logo-name">GESTAR ERP</div>
      <div class="logo-sub">Panamá</div>
    </div>
    <div class="body">
      <h2>${titulo}</h2>
      ${cuerpo}
    </div>
    <div class="footer">GESTAR ERP · Sistema de Contabilidad y Gestión para Panamá · No respondas este correo</div>
  </div>
</body></html>`;
}

async function enviarBienvenida({ nombre, nombreEmpresa, email }) {
  const html = templateBase(
    `¡Bienvenido a GESTAR ERP, ${nombre}!`,
    `<p>Tu empresa <strong>${nombreEmpresa}</strong> ya está registrada y lista para operar.</p>
     <p>Tu acceso:</p>
     <div class="info-box">
       <div class="info-row"><span class="info-label">Email</span><span class="info-val">${email}</span></div>
       <div class="info-row"><span class="info-label">Rol</span><span class="info-val">Administrador</span></div>
     </div>
     <p><strong>Próximo paso recomendado:</strong> ve a <em>Contabilidad → Plan de Cuentas</em> y ejecuta la semilla para tener el plan de cuentas panameño listo.</p>
     <p style="margin-top:20px;font-size:12px;color:#aaa">Si no creaste esta cuenta, ignora este correo.</p>`
  );
  await enviarEmail({ to: email, subject: '¡Bienvenido a GESTAR ERP!', html });
}

async function enviarRecuperacionPassword({ nombre, email, enlace }) {
  const html = templateBase(
    'Recuperar contraseña',
    `<p>Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
     <p>Haz clic en el botón para crear una nueva contraseña. El enlace expira en <strong>1 hora</strong>.</p>
     <p style="text-align:center"><a class="btn" href="${enlace}">Restablecer contraseña →</a></p>
     <p>O copia este enlace en tu navegador:</p>
     <div class="token-box">${enlace}</div>
     <p style="font-size:12px;color:#aaa">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>`
  );
  await enviarEmail({ to: email, subject: 'Recuperar contraseña — GESTAR ERP', html });
}

async function enviarFactura({ clienteEmail, clienteNombre, numeroFactura, total, empresaNombre, enlacePDF }) {
  const html = templateBase(
    `Factura ${numeroFactura}`,
    `<p>Estimado/a <strong>${clienteNombre}</strong>,</p>
     <p>Adjuntamos la factura emitida por <strong>${empresaNombre}</strong>.</p>
     <div class="info-box">
       <div class="info-row"><span class="info-label">Número</span><span class="info-val">${numeroFactura}</span></div>
       <div class="info-row"><span class="info-label">Total</span><span class="info-val">B/. ${Number(total).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
     </div>
     ${enlacePDF ? `<p style="text-align:center"><a class="btn" href="${enlacePDF}">Ver / Descargar PDF →</a></p>` : ''}
     <p style="font-size:12px;color:#aaa">Para consultas responde a este correo o contacta directamente a ${empresaNombre}.</p>`
  );
  await enviarEmail({ to: clienteEmail, subject: `Factura ${numeroFactura} — ${empresaNombre}`, html });
}

async function enviarOrdenCompra({ proveedorEmail, proveedorNombre, numeroOC, total, empresaNombre, enlacePDF }) {
  const html = templateBase(
    `Orden de Compra ${numeroOC}`,
    `<p>Estimado/a <strong>${proveedorNombre}</strong>,</p>
     <p>Le enviamos la siguiente orden de compra de <strong>${empresaNombre}</strong>. Por favor confirme la recepción y disponibilidad.</p>
     <div class="info-box">
       <div class="info-row"><span class="info-label">N° Orden</span><span class="info-val">${numeroOC}</span></div>
       <div class="info-row"><span class="info-label">Total</span><span class="info-val">B/. ${Number(total).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
     </div>
     ${enlacePDF ? `<p style="text-align:center"><a class="btn" href="${enlacePDF}">Ver / Descargar Orden →</a></p>` : ''}
     <p style="font-size:12px;color:#aaa">Para consultas responde a este correo o contacta directamente a ${empresaNombre}.</p>`
  );
  await enviarEmail({ to: proveedorEmail, subject: `Orden de Compra ${numeroOC} — ${empresaNombre}`, html });
}

async function enviarComprobanteNomina({ empleadoEmail, empleadoNombre, empresaNombre, periodo, linea }) {
  const fmtMoney = (n) => `B/. ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-PA') : '—';
  const tipoPeriodo = periodo.tipo === 'DECIMO' ? 'Décimo Tercer Mes' : 'Nómina Regular';

  const filas = [
    ['Salario base del período', fmtMoney(linea.salarioBruto), '#1a1a2e'],
    ...(linea.otrosIngresos > 0 ? [['Bonos / Horas extra', `+ ${fmtMoney(linea.otrosIngresos)}`, '#00C896']] : []),
    ['CSS empleado (9.75%)', `- ${fmtMoney(linea.cssEmpleado)}`, '#FF6B6B'],
    ['SEA empleado (1.25%)', `- ${fmtMoney(linea.seaEmpleado)}`, '#FF6B6B'],
    ...(linea.isr > 0 ? [['ISR', `- ${fmtMoney(linea.isr)}`, '#FF6B6B']] : []),
    ...(linea.otrosDescuentos > 0 ? [['Otros descuentos', `- ${fmtMoney(linea.otrosDescuentos)}`, '#FF6B6B']] : []),
  ].map(([label, valor, color]) => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px">
      <span style="color:#888">${label}</span>
      <span style="color:${color};font-weight:600">${valor}</span>
    </div>`).join('');

  const html = templateBase(
    `Comprobante de pago — ${periodo.numero}`,
    `<p>Estimado/a <strong>${empleadoNombre}</strong>,</p>
     <p>A continuación el detalle de su pago de <strong>${tipoPeriodo}</strong> emitido por <strong>${empresaNombre}</strong>.</p>
     <div class="info-box">
       <div class="info-row"><span class="info-label">Período</span><span class="info-val">${fmtFecha(periodo.fechaInicio)} – ${fmtFecha(periodo.fechaFin)}</span></div>
       <div class="info-row"><span class="info-label">Fecha de pago</span><span class="info-val">${fmtFecha(periodo.fechaPago)}</span></div>
     </div>
     <div style="margin:16px 0">${filas}</div>
     <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;border-top:2px solid #eee">
       <span>Neto a recibir</span>
       <span style="color:#00C896">${fmtMoney(linea.salarioNeto)}</span>
     </div>
     ${linea.notas ? `<p style="font-size:12px;color:#888;margin-top:12px">Nota: ${linea.notas}</p>` : ''}
     <p style="font-size:12px;color:#aaa;margin-top:16px">Si tienes alguna duda sobre este comprobante, contacta al departamento de RRHH.</p>`
  );

  await enviarEmail({ to: empleadoEmail, subject: `Comprobante de pago ${periodo.numero} — ${empresaNombre}`, html });
}

module.exports = { enviarBienvenida, enviarRecuperacionPassword, enviarFactura, enviarOrdenCompra, enviarComprobanteNomina };
