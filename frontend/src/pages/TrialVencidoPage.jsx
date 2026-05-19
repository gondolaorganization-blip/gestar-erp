export default function TrialVencidoPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0D1B2A 0%, #1a2a3a 100%)", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 480, width: "100%",
        textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0D1B2A", marginBottom: 12 }}>
          Tu período de prueba ha vencido
        </h1>
        <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Los 14 días de prueba gratuita de <strong>GESTAR ERP</strong> han concluido.
          Contáctanos para activar tu plan y continuar sin interrupciones.
        </p>
        <a
          href="mailto:gondola.organization@gmail.com?subject=Activar%20plan%20GESTAR%20ERP"
          style={{
            display: "block", background: "#00C896", color: "#fff", fontWeight: 700,
            fontSize: 15, padding: "14px 24px", borderRadius: 8, textDecoration: "none",
            marginBottom: 16,
          }}
        >
          Contactar para activar mi plan
        </a>
        <button
          onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('usuario'); window.location.href = '/login'; }}
          style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer" }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
