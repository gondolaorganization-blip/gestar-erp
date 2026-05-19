import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function PrivacidadPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#fff", color: "#1a1a2e", minHeight: "100vh" }}>
      <style>{`
        .legal-wrap { max-width: 800px; margin: 0 auto; padding: 48px 24px 80px; }
        .legal-wrap h1 { font-size: 28px; font-weight: 800; margin-bottom: 6px; font-family: 'Arial', sans-serif; }
        .legal-wrap h2 { font-size: 17px; font-weight: 700; margin: 32px 0 10px; font-family: 'Arial', sans-serif; color: #0F2744; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
        .legal-wrap p, .legal-wrap li { font-size: 14px; line-height: 1.8; color: #374151; margin-bottom: 10px; }
        .legal-wrap ul { padding-left: 20px; margin-bottom: 10px; }
        .legal-wrap li { margin-bottom: 4px; }
        .legal-wrap strong { color: #1a1a2e; }
        .legal-meta { font-size: 12px; color: #9CA3AF; margin-bottom: 32px; }
        .legal-header { background: #0A0D13; padding: 18px 24px; display: flex; align-items: center; gap: 16px; }
        .legal-footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
        .highlight-box { background: #f0f7ff; border-left: 4px solid #4E9AF1; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 16px 0; }
        @media (max-width: 600px) { .legal-wrap { padding: 28px 16px 60px; } }
      `}</style>

      {/* Header */}
      <div className="legal-header">
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#4E9AF1,#00C896)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff" }}>G</div>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#E8EDFF" }}>GESTAR ERP</span>
        </Link>
      </div>

      <div className="legal-wrap">
        <h1>Política de Privacidad y Protección de Datos</h1>
        <p className="legal-meta">Última actualización: 13 de mayo de 2026 · Gestar Consultores</p>

        <div className="highlight-box">
          <strong>Resumen:</strong> Recopilamos solo los datos necesarios para operar el servicio. No vendemos ni compartimos tu información con terceros con fines comerciales. Cumplimos con la <strong>Ley 81 de 26 de marzo de 2019</strong> de Protección de Datos Personales de la República de Panamá.
        </div>

        <h2>1. Responsable del Tratamiento</h2>
        <p><strong>Gestar Consultores</strong>, con domicilio en la República de Panamá, es la empresa responsable del tratamiento de los datos personales recopilados a través de la plataforma GESTAR ERP.</p>
        <p>Contacto del responsable: <strong>privacidad@gestar-erp.com</strong></p>

        <h2>2. Marco Legal</h2>
        <p>Esta política se rige por la <strong>Ley 81 de 26 de marzo de 2019</strong> sobre Protección de Datos Personales de Panamá y su reglamentación, así como por los principios del Convenio 108 del Consejo de Europa en lo aplicable.</p>

        <h2>3. Datos que Recopilamos</h2>
        <p><strong>Datos de la empresa cliente:</strong></p>
        <ul>
          <li>RUC, nombre legal y comercial, dirección, teléfono, correo electrónico</li>
        </ul>
        <p><strong>Datos de usuarios del sistema:</strong></p>
        <ul>
          <li>Nombre completo, correo electrónico, contraseña (almacenada cifrada con bcrypt)</li>
          <li>Fecha y hora del último acceso</li>
        </ul>
        <p><strong>Datos operativos ingresados por el cliente:</strong></p>
        <ul>
          <li>Información de clientes, proveedores, empleados, facturas, transacciones contables, nómina y estados de cuenta bancarios que el usuario decida cargar</li>
          <li>Estos datos pertenecen exclusivamente al cliente y son tratados por Gestar Consultores únicamente como encargado del tratamiento</li>
        </ul>
        <p><strong>Datos técnicos:</strong></p>
        <ul>
          <li>Dirección IP, tipo de navegador, sistema operativo (registrados en logs del servidor con fines de seguridad)</li>
        </ul>

        <h2>4. Finalidad del Tratamiento</h2>
        <ul>
          <li><strong>Prestación del servicio:</strong> operar y mantener la plataforma GESTAR ERP para el cliente</li>
          <li><strong>Comunicaciones del servicio:</strong> enviar notificaciones transaccionales (facturas creadas, recuperación de contraseña, alertas del sistema)</li>
          <li><strong>Seguridad:</strong> detectar y prevenir accesos no autorizados o usos fraudulentos</li>
          <li><strong>Mejora del servicio:</strong> análisis agregado y anónimo del uso de la plataforma</li>
          <li><strong>Cumplimiento legal:</strong> atender requerimientos de autoridades competentes cuando sea legalmente exigible</li>
        </ul>

        <h2>5. Base Legal del Tratamiento</h2>
        <ul>
          <li>Ejecución del contrato de servicio suscrito con el cliente (Art. 9, Ley 81)</li>
          <li>Consentimiento del titular al registrarse en la plataforma</li>
          <li>Interés legítimo para la seguridad y prevención del fraude</li>
          <li>Obligación legal cuando así lo requiera una autoridad competente</li>
        </ul>

        <h2>6. Inteligencia Artificial</h2>
        <p>GESTAR ERP utiliza la API de <strong>Anthropic (Claude)</strong> para dos funcionalidades: el asistente financiero y la importación de estados de cuenta bancarios.</p>
        <ul>
          <li>Los datos enviados a la IA incluyen información financiera de la empresa (montos, descripciones de transacciones, plan de cuentas)</li>
          <li>No se envían datos personales identificables de empleados ni clientes individuales a servicios de IA</li>
          <li>Anthropic procesa estos datos conforme a su propia política de privacidad y no los usa para entrenar modelos según sus términos comerciales</li>
        </ul>

        <h2>7. Conservación de los Datos</h2>
        <ul>
          <li>Los datos se conservan mientras la suscripción esté activa</li>
          <li>Tras la cancelación, los datos se mantienen por <strong>30 días calendario</strong> para permitir la exportación, luego son eliminados definitivamente</li>
          <li>Los logs de seguridad se conservan por 90 días</li>
        </ul>

        <h2>8. Seguridad de los Datos</h2>
        <p>Implementamos las siguientes medidas de seguridad técnica:</p>
        <ul>
          <li>Contraseñas cifradas con bcrypt (factor de costo 10)</li>
          <li>Comunicaciones cifradas mediante HTTPS/TLS</li>
          <li>Autenticación mediante tokens JWT con expiración de 8 horas</li>
          <li>Aislamiento de datos por empresa (arquitectura multi-tenant)</li>
          <li>Cabeceras de seguridad HTTP (Helmet: CSP, HSTS, X-Frame-Options)</li>
          <li>Límites de intentos de acceso para prevenir fuerza bruta</li>
          <li>Backups periódicos de la base de datos</li>
        </ul>

        <h2>9. Transferencia de Datos a Terceros</h2>
        <p>Gestar Consultores <strong>no vende ni arrienda</strong> datos personales a terceros. Los datos pueden ser compartidos únicamente con:</p>
        <ul>
          <li><strong>Proveedores de infraestructura</strong> (servidor en la nube) que actúan como encargados del tratamiento bajo acuerdo de confidencialidad</li>
          <li><strong>Anthropic</strong>, para las funcionalidades de IA, conforme a lo indicado en la sección 6</li>
          <li><strong>Autoridades competentes</strong> de la República de Panamá cuando exista requerimiento legal válido</li>
        </ul>

        <h2>10. Derechos del Titular (Ley 81 de 2019)</h2>
        <p>Conforme a la Ley 81, el titular de los datos personales tiene derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> conocer qué datos personales suyos tratamos</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos</li>
          <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando no sean necesarios para la finalidad original</li>
          <li><strong>Oposición:</strong> oponerse al tratamiento en casos específicos previstos por la ley</li>
          <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado y legible por máquina</li>
          <li><strong>Revocación del consentimiento:</strong> retirar el consentimiento en cualquier momento, sin efecto retroactivo</li>
        </ul>
        <p>Para ejercer estos derechos, envía una solicitud a <strong>privacidad@gestar-erp.com</strong> con tu nombre, correo registrado y descripción de la solicitud. Responderemos en un plazo máximo de <strong>30 días hábiles</strong>.</p>

        <h2>11. Cookies</h2>
        <p>GESTAR ERP no utiliza cookies de rastreo ni publicidad. Únicamente se utiliza el almacenamiento local del navegador (<em>localStorage</em>) para mantener la sesión activa del usuario de forma segura.</p>

        <h2>12. Cambios a esta Política</h2>
        <p>Podremos actualizar esta Política de Privacidad para reflejar cambios en el servicio o en la legislación aplicable. Notificaremos cambios materiales al correo registrado con al menos 15 días de anticipación.</p>

        <h2>13. Autoridad de Control</h2>
        <p>Si considera que el tratamiento de sus datos personales infringe la Ley 81 de 2019, puede presentar una reclamación ante la <strong>Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI)</strong> de la República de Panamá.</p>

        <h2>14. Contacto</h2>
        <p>Para cualquier consulta relacionada con la privacidad de sus datos: <strong>privacidad@gestar-erp.com</strong></p>
      </div>

      <div className="legal-footer">
        © 2026 Gestar Consultores · República de Panamá ·{" "}
        <Link to="/terminos" style={{ color: "#4E9AF1", textDecoration: "none" }}>Términos de Servicio</Link>
        {" · "}
        <Link to="/" style={{ color: "#4E9AF1", textDecoration: "none" }}>Volver al inicio</Link>
      </div>
    </div>
  );
}
