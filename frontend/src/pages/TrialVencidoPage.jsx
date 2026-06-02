import { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import api from "../services/api";

const FEATURES = {
  EMPRENDE:    ["Facturación electrónica DGI", "Ingresos y gastos", "ITBMS automático", "1 empresa", "1 usuario"],
  BASICO:      ["Todo lo de Emprende", "Contabilidad básica", "Clientes y proveedores", "2 usuarios", "Soporte email"],
  PROFESIONAL: ["Todo lo de Básico", "Inventario", "Nómina Panamá", "CRM", "5 usuarios", "Asistente IA", "Soporte prioritario"],
  DESPACHO:    ["Todo lo de Profesional", "Multiempresa (hasta 10)", "Usuarios ilimitados", "Roles avanzados", "Soporte dedicado"],
  ENTERPRISE:  ["Todo lo de Despacho", "Empresas ilimitadas", "White label", "API access", "Soporte 24/7"],
};

export default function TrialVencidoPage() {
  const [planes, setPlanes] = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState("PROFESIONAL");
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/paypal/planes")
      .then((r) => { setPlanes(r.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const planActual = planes.find((p) => p.nombre === planSeleccionado);
  const clientId   = import.meta.env.VITE_PAYPAL_CLIENT_ID;

  const handleApprove = async (data) => {
    setError("");
    try {
      await api.post("/paypal/activar", { subscriptionId: data.subscriptionID });
      setExito(true);
      setTimeout(() => { window.location.href = "/dashboard"; }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Error al activar. Contacta soporte.");
    }
  };

  if (exito) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D1B2A" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0D1B2A", marginBottom: 8 }}>¡Plan activado!</h2>
          <p style={{ color: "#6B7280" }}>Redirigiendo al sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0D1B2A 0%, #1a2a3a 100%)", padding: "40px 16px", fontFamily: "Syne, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Tu período de prueba ha vencido</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Elige un plan para continuar usando GESTAR ERP sin interrupciones.</p>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>Cargando planes...</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 32 }}>
              {planes.map((plan) => (
                <div
                  key={plan.nombre}
                  onClick={() => setPlanSeleccionado(plan.nombre)}
                  style={{
                    cursor: "pointer", borderRadius: 14, border: `2px solid ${planSeleccionado === plan.nombre ? "#00C896" : "rgba(255,255,255,0.1)"}`,
                    background: planSeleccionado === plan.nombre ? "rgba(0,200,150,0.08)" : "rgba(255,255,255,0.03)",
                    padding: "20px 16px", transition: "all 0.2s",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#00C896", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    {plan.label}
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 2 }}>
                    B/.{plan.precio}<span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>/mes</span>
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                    {(FEATURES[plan.nombre] || []).map((f) => (
                      <li key={f} style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>✓ {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {planActual?.paypalPlanId ? (
              <div style={{ maxWidth: 380, margin: "0 auto" }}>
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
                  Plan: <strong style={{ color: "#fff" }}>{planActual.label}</strong> — B/.{planActual.precio}/mes
                </p>
                {clientId ? (
                  <PayPalScriptProvider options={{ clientId, vault: true, intent: "subscription" }}>
                    <PayPalButtons
                      style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
                      createSubscription={(_d, actions) => actions.subscription.create({ plan_id: planActual.paypalPlanId })}
                      onApprove={handleApprove}
                      onError={() => setError("Error en el proceso de pago. Intenta de nuevo.")}
                    />
                  </PayPalScriptProvider>
                ) : (
                  <div style={{ background: "rgba(255,200,0,0.1)", border: "1px solid rgba(255,200,0,0.3)", borderRadius: 10, padding: 16, textAlign: "center", color: "#FCD34D", fontSize: 13 }}>
                    Configura <code>VITE_PAYPAL_CLIENT_ID</code> para activar los pagos.
                  </div>
                )}
                {error && (
                  <p style={{ marginTop: 16, color: "#F87171", background: "rgba(248,113,113,0.1)", borderRadius: 8, padding: "10px 16px", textAlign: "center", fontSize: 13 }}>{error}</p>
                )}
              </div>
            ) : (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                Este plan no tiene pago en línea configurado.{" "}
                <a href="mailto:gondola.organization@gmail.com" style={{ color: "#00C896" }}>Contáctanos.</a>
              </p>
            )}
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button
            onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("usuario"); window.location.href = "/login"; }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer" }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
