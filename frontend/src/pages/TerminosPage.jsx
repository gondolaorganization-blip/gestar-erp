import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function TerminosPage() {
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
        <h1>Términos y Condiciones de Servicio</h1>
        <p className="legal-meta">Última actualización: 13 de mayo de 2026 · Gestar Consultores</p>

        <p>Los presentes Términos y Condiciones de Servicio (en adelante, "los Términos") regulan el acceso y uso de la plataforma de software como servicio (SaaS) denominada <strong>GESTAR ERP</strong>, operada por <strong>Gestar Consultores</strong> (en adelante, "la Empresa"), con domicilio en la República de Panamá.</p>
        <p>Al registrarse, acceder o utilizar GESTAR ERP, el usuario acepta íntegramente estos Términos. Si no está de acuerdo, debe abstenerse de usar el servicio.</p>

        <h2>1. Descripción del Servicio</h2>
        <p>GESTAR ERP es una plataforma de gestión empresarial en línea que ofrece módulos de facturación, contabilidad, nómina, inventario, cuentas por cobrar y pagar, CRM, impuestos y reportes financieros, diseñada para empresas operando en la República de Panamá.</p>
        <p>El servicio se presta a través de internet mediante suscripción mensual o anual, según el plan seleccionado por el cliente.</p>

        <h2>2. Registro y Cuenta de Usuario</h2>
        <ul>
          <li>Para usar el servicio es obligatorio registrar una empresa con RUC válido panameño y un usuario administrador con correo electrónico verificable.</li>
          <li>El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
          <li>Cada empresa registrada constituye un espacio de datos independiente y aislado de los demás clientes.</li>
          <li>Gestar Consultores se reserva el derecho de suspender cuentas que proporcionen información falsa o fraudulenta.</li>
        </ul>

        <h2>3. Planes y Pagos</h2>
        <ul>
          <li>El servicio se ofrece bajo distintos planes de suscripción con precios publicados en el sitio web oficial.</li>
          <li>Los precios están expresados en dólares estadounidenses (USD), moneda de curso legal en la República de Panamá.</li>
          <li>El pago es mensual o anual por adelantado, según el plan elegido. No se realizan reembolsos por períodos parciales.</li>
          <li>La falta de pago por más de 15 días calendario podrá resultar en la suspensión del acceso. Los datos se conservarán por 30 días adicionales antes de ser eliminados definitivamente.</li>
          <li>Gestar Consultores podrá modificar los precios con un preaviso de 30 días al correo electrónico registrado.</li>
        </ul>

        <h2>4. Uso Aceptable</h2>
        <p>El usuario se compromete a:</p>
        <ul>
          <li>Utilizar el servicio exclusivamente para fines lícitos y conforme a la legislación panameña vigente.</li>
          <li>No intentar acceder a datos de otras empresas registradas en la plataforma.</li>
          <li>No realizar ingeniería inversa, descompilar ni reproducir el software.</li>
          <li>No utilizar el sistema para registrar transacciones ficticias, evasión fiscal o cualquier actividad ilícita.</li>
          <li>Mantener actualizados los datos de su empresa en el sistema.</li>
        </ul>

        <h2>5. Exactitud de los Datos Contables y Fiscales</h2>
        <p>GESTAR ERP aplica automáticamente las tasas fiscales vigentes en Panamá (ITBMS 7%, CSS, SEA, ISR) conforme a la legislación publicada al momento del desarrollo. Sin embargo:</p>
        <ul>
          <li>Es responsabilidad del usuario verificar que los cálculos sean correctos para su caso específico.</li>
          <li>Gestar Consultores no asume responsabilidad por errores fiscales derivados de cambios en la legislación no reflejados aún en el sistema, ni por configuraciones incorrectas realizadas por el usuario.</li>
          <li>El sistema genera documentos de apoyo contable; la revisión final y firma de estados financieros corresponde a un Contador Público Autorizado (CPA) habilitado.</li>
        </ul>

        <h2>6. Disponibilidad del Servicio</h2>
        <ul>
          <li>Gestar Consultores procura una disponibilidad del 99% mensual, excluyendo mantenimientos programados con aviso previo.</li>
          <li>No garantizamos disponibilidad ininterrumpida. No seremos responsables por pérdidas derivadas de interrupciones del servicio fuera de nuestro control.</li>
        </ul>

        <h2>7. Propiedad Intelectual</h2>
        <p>Todo el software, diseño, código fuente, logotipos y contenido de GESTAR ERP son propiedad exclusiva de Gestar Consultores y están protegidos por las leyes de propiedad intelectual de la República de Panamá y tratados internacionales aplicables.</p>
        <p>Los datos ingresados por el cliente en la plataforma son propiedad del cliente. Gestar Consultores no reclamará derechos sobre ellos.</p>

        <h2>8. Limitación de Responsabilidad</h2>
        <p>En la máxima medida permitida por la ley panameña, Gestar Consultores no será responsable por daños indirectos, incidentales, especiales o consecuentes, incluyendo pérdida de ingresos, pérdida de datos o interrupción de negocios.</p>
        <p>La responsabilidad total de Gestar Consultores frente al cliente no excederá el monto pagado por el servicio en los últimos 3 meses.</p>

        <h2>9. Cancelación</h2>
        <ul>
          <li>El cliente puede cancelar su suscripción en cualquier momento desde el panel de configuración o enviando un correo a soporte.</li>
          <li>Tras la cancelación, el acceso se mantiene activo hasta el fin del período pagado.</li>
          <li>El cliente puede exportar sus datos en cualquier momento antes de la cancelación definitiva.</li>
        </ul>

        <h2>10. Modificaciones a los Términos</h2>
        <p>Gestar Consultores podrá modificar estos Términos en cualquier momento. Los cambios materiales serán notificados al correo registrado con al menos 15 días de anticipación. El uso continuado del servicio tras la notificación implica aceptación de los nuevos términos.</p>

        <h2>11. Ley Aplicable y Jurisdicción</h2>
        <p>Estos Términos se rigen por las leyes de la <strong>República de Panamá</strong>. Cualquier controversia será sometida a los tribunales competentes de la ciudad de Panamá, renunciando las partes a cualquier otro fuero que pudiera corresponderles.</p>

        <h2>12. Contacto</h2>
        <p>Para consultas sobre estos Términos: <strong>legal@gestar-erp.com</strong></p>
      </div>

      <div className="legal-footer">
        © 2026 Gestar Consultores · República de Panamá ·{" "}
        <Link to="/privacidad" style={{ color: "#4E9AF1", textDecoration: "none" }}>Política de Privacidad</Link>
        {" · "}
        <Link to="/" style={{ color: "#4E9AF1", textDecoration: "none" }}>Volver al inicio</Link>
      </div>
    </div>
  );
}
