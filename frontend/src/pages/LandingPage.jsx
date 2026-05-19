import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

const PLANS = [
  {
    id: "basico",
    name: "Básico",
    price: 49,
    annual: 39,
    desc: "Para freelancers y negocios pequeños",
    color: "#64B5F6",
    features: [
      "Facturación electrónica DGI",
      "Dashboard financiero",
      "Cuentas por cobrar",
      "Hasta 100 facturas/mes",
      "1 usuario",
      "Soporte por email",
    ],
    notIncluded: ["Contabilidad completa", "Nómina Panamá", "Módulo de inventario", "Asistente IA"],
  },
  {
    id: "profesional",
    name: "Profesional",
    price: 99,
    annual: 79,
    desc: "Para despachos y empresas en crecimiento",
    color: "#00C896",
    popular: true,
    features: [
      "Todo lo del plan Básico",
      "Contabilidad general completa",
      "Impuestos y formularios DGI",
      "Nómina Panamá (CSS, ISR, 13°)",
      "CRM básico con pipeline",
      "Facturas ilimitadas",
      "3 usuarios incluidos",
      "Asistente IA contable",
      "Soporte prioritario WhatsApp",
    ],
    notIncluded: ["White label", "API pública"],
  },
  {
    id: "despacho",
    name: "Despacho",
    price: 149,
    annual: 119,
    desc: "Para firmas y despachos multicliente",
    color: "#F5A623",
    features: [
      "Todo lo del plan Profesional",
      "Hasta 5 empresas (multiempresa)",
      "10 usuarios incluidos",
      "Inventario con kardex y FIFO",
      "Reportes avanzados y BI",
      "Integraciones bancarias (BG, BAC)",
      "Exportación SIPE y banco",
      "Soporte dedicado + onboarding",
    ],
    notIncluded: ["White label"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 299,
    annual: 239,
    desc: "Para grupos empresariales y revendedores",
    color: "#E879F9",
    features: [
      "Todo lo del plan Despacho",
      "Empresas ilimitadas",
      "Usuarios ilimitados",
      "White label con tu marca",
      "API pública documentada",
      "Integraciones Make / Zapier",
      "Precios de transferencia",
      "CRS / FATCA básico",
      "Gerente de cuenta dedicado",
    ],
    notIncluded: [],
  },
];

const FEATURES = [
  { icon: "◈", title: "Facturación Electrónica DGI", desc: "Emite facturas en PDF, envíalas por email y lleva control de cobros. Integración DGI/CAE próximamente.", pronto: true },
  { icon: "≡", title: "Contabilidad Panameña", desc: "Catálogo de cuentas local, asientos automáticos, balance general y estado de resultados con un clic." },
  { icon: "⊕", title: "Nómina Panamá", desc: "CSS, seguro educativo, ISR, décimo tercer mes, ajustes individuales y comprobantes por email." },
  { icon: "✦", title: "Asistente IA Financiero", desc: "Pregúntale a tu contador virtual: flujo de caja, proyecciones, alertas de impuestos y análisis en tiempo real." },
  { icon: "⊠", title: "Impuestos y DGI", desc: "ITBMS 7%, retenciones, cálculo automático y alertas de vencimiento. Formularios DGI próximamente.", pronto: true },
  { icon: "◎", title: "CRM integrado", desc: "Gestiona leads, pipeline de ventas y seguimiento de oportunidades desde el mismo sistema." },
];

const TESTIMONIALS = [
  { name: "Licda. Carmen Herrera", role: "Contadora, Ciudad de Panamá", text: "Cerré el mes en 2 horas. Antes me tomaba 2 días. La nómina con CSS integrado es lo mejor que he visto en Panamá.", avatar: "CH" },
  { name: "Ing. Roberto Díaz", role: "Dueño, Constructora Del Rey", text: "El asistente IA me explica mis estados financieros sin llamar al contador. Vale cada centavo del plan Profesional.", avatar: "RD" },
  { name: "Lic. Mariana Solís", role: "Abogada, firma propia", text: "Mis clientes me pagan más rápido porque las facturas llegan al instante con código QR. Las cuentas por cobrar bajaron 40%.", avatar: "MS" },
];

const FAQS = [
  { q: "¿Está conectado a la DGI de Panamá?", a: "Sí. Gestar ERP utiliza un PAC autorizado para emitir facturas electrónicas con CAE/CUFE válido ante la DGI. Cumple con todas las resoluciones vigentes." },
  { q: "¿Puedo migrar desde QuickBooks o Peachtree?", a: "Sí. Ofrecemos migración de datos asistida sin costo adicional en los planes Despacho y Enterprise. Para Básico y Profesional el costo es B/. 299." },
  { q: "¿Hay un período de prueba gratuito?", a: "Sí. Todos los planes incluyen 14 días de prueba gratuita sin necesidad de tarjeta de crédito. Al finalizar el período puedes elegir tu plan o contactarnos." },
  { q: "¿Cómo funcionan los pagos?", a: "Aceptamos tarjeta de crédito/débito (Visa, Mastercard), Yappy y transferencia bancaria. Los pagos anuales tienen 20% de descuento aplicado automáticamente." },
  { q: "¿Hay contrato de permanencia?", a: "No. Todos los planes son mes a mes. Puedes cancelar cuando quieras sin penalidad. El plan anual se cobra por adelantado." },
  { q: "¿Mis datos están seguros?", a: "Sí. Servidores en AWS con encriptación AES-256, backups diarios automáticos, 2FA disponible y auditoría completa de accesos." },
  { q: "¿Funciona para múltiples empresas?", a: "El plan Despacho soporta hasta 5 empresas y el Enterprise es ilimitado. Ideal para despachos contables o grupos empresariales." },
];

function CheckIcon({ color }) {
  return <span style={{ color, fontSize: 13, fontWeight: 700 }}>✓</span>;
}
function XIcon() {
  return <span style={{ color: "#2A2F3E", fontSize: 13 }}>✗</span>;
}

export default function GestarERPLanding() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [scrolled, setScrolled] = useState(false);
  const pricingRef = useRef(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: "smooth" });

  const openPayment = (plan) => {
    setSelectedPlan(plan);
    setPayModal(true);
  };

  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', 'Outfit', sans-serif", background: "#F7F8FC", color: "#111827", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --green: #00C896;
          --green-light: #E6FAF5;
          --navy: #0D1B2A;
          --blue: #1A6BF5;
          --yellow: #F5A623;
          --text: #111827;
          --muted: #6B7280;
          --border: #E5E7EB;
          --card: #FFFFFF;
        }
        html { scroll-behavior: smooth; }
        body { background: #F7F8FC; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .btn-primary {
          background: var(--green); color: #fff; border: none; border-radius: 10px;
          padding: 13px 28px; font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: 'Outfit', sans-serif; transition: all 0.18s ease;
          box-shadow: 0 4px 20px rgba(0,200,150,0.35);
        }
        .btn-primary:hover { background: #00B085; transform: translateY(-1px); box-shadow: 0 6px 28px rgba(0,200,150,0.45); }
        .btn-outline {
          background: transparent; color: var(--navy); border: 1.5px solid #D1D5DB;
          border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.15s ease;
        }
        .btn-outline:hover { border-color: var(--green); color: var(--green); }
        .plan-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
        .faq-item { cursor: pointer; transition: background 0.15s; border-radius: 12px; }
        .faq-item:hover { background: #F3F4F6; }
        .pay-method { cursor: pointer; transition: all 0.15s ease; border-radius: 10px; }
        .pay-method:hover { border-color: var(--green) !important; }
        .feature-card { transition: all 0.2s ease; }
        .feature-card:hover { background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.07); transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .float { animation: float 4s ease infinite; }
        .badge-popular {
          position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, #00C896, #00A87E);
          color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 4px 16px; border-radius: 20px;
          white-space: nowrap; box-shadow: 0 4px 16px rgba(0,200,150,0.4);
        }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .toggle-track { width: 44px; height: 24px; border-radius: 12px; background: #E5E7EB; position: relative; cursor: pointer; transition: background 0.2s; }
        .toggle-track.on { background: var(--green); }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .toggle-track.on .toggle-thumb { left: 23px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "none",
        padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #00C896 0%, #1A6BF5 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff",
          }}>G</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#0D1B2A", letterSpacing: "-0.02em" }}>
            Gestar <span style={{ color: "#00C896" }}>ERP</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Funciones", "Precios", "FAQ"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ fontSize: 14, fontWeight: 600, color: "#4B5563", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "#00C896"}
              onMouseLeave={e => e.target.style.color = "#4B5563"}
            >{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" style={{ padding: "9px 20px", fontSize: 13 }} onClick={() => navigate("/login")}>Iniciar sesión</button>
          <button className="btn-outline" style={{ padding: "9px 20px", fontSize: 13 }} onClick={() => navigate("/registro")}>Crear cuenta</button>
          <button className="btn-primary" style={{ padding: "9px 20px", fontSize: 13 }} onClick={scrollToPricing}>Ver planes</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg, #0D1B2A 0%, #0F2744 50%, #0D2E1F 100%)",
        position: "relative", overflow: "hidden", paddingTop: 80,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        <div style={{ position: "absolute", top: "20%", left: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,150,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "10%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,107,245,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div style={{ textAlign: "center", maxWidth: 800, padding: "0 24px", position: "relative", zIndex: 1 }}>
          <div className="fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.25)",
            borderRadius: 20, padding: "6px 16px", marginBottom: 28,
          }}>
            <span style={{ fontSize: 10, color: "#00C896", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              🇵🇦 Hecho para Panamá
            </span>
          </div>

          <h1 className="fade-up" style={{
            fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 900, color: "#FFFFFF",
            lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 24,
            animationDelay: "0.1s",
          }}>
            El ERP que entiende<br />
            <span style={{ background: "linear-gradient(90deg, #00C896, #1A6BF5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              cómo funciona Panamá
            </span>
          </h1>

          <p className="fade-up" style={{
            fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.7,
            maxWidth: 560, margin: "0 auto 40px", animationDelay: "0.2s",
          }}>
            Facturación electrónica DGI, nómina con CSS integrado, contabilidad local y asistente IA financiero — todo en un sistema diseñado para la realidad empresarial panameña.
          </p>

          <div className="fade-up" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.3s" }}>
            <button className="btn-primary" style={{ fontSize: 16, padding: "15px 36px" }} onClick={scrollToPricing}>
              Empezar gratis — 14 días sin costo
            </button>
            <button className="btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 16, padding: "15px 32px" }}
              onClick={() => navigate("/login")}>
              Ver demo ↗
            </button>
          </div>

          <div className="fade-up" style={{ marginTop: 48, display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.4s" }}>
            {[["DGI", "Certificado"], ["CSS", "Integrado"], ["Yappy", "Aceptado"], ["IA", "Incluida"]].map(([t, s]) => (
              <div key={t} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#00C896", fontFamily: "'DM Mono', monospace" }}>{t}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.06em" }}>{s}</div>
              </div>
            ))}
          </div>

          <div className="float" style={{
            marginTop: 56, borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.5)",
            background: "#111620",
          }}>
            <div style={{ background: "#0D1117", padding: "10px 16px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["#FF6B6B", "#F5A623", "#00C896"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 18, marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>app.gestarconsultores.com/erp</span>
              </div>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { l: "Ingresos", v: "B/. 48,720", c: "#00C896" },
                { l: "Gastos", v: "B/. 21,340", c: "#FF6B6B" },
                { l: "CxC", v: "B/. 15,880", c: "#4E9AF1" },
                { l: "ITBMS", v: "B/. 3,410", c: "#F5A623" },
              ].map(k => (
                <div key={k.l} style={{ background: "#0D1117", borderRadius: 8, padding: "12px 14px", border: `1px solid ${k.c}18` }}>
                  <div style={{ fontSize: 9, color: "#4B5675", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EDFF", fontFamily: "'DM Mono', monospace" }}>{k.v}</div>
                  <div style={{ marginTop: 6, height: 2, background: `${k.c}22`, borderRadius: 1 }}>
                    <div style={{ height: "100%", width: "65%", background: k.c, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funciones" style={{ padding: "100px 48px", background: "#F7F8FC" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-block", background: "#E6FAF5", color: "#00A87E", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Funcionalidades</div>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: "#0D1B2A", letterSpacing: "-0.025em", marginBottom: 14 }}>
              Todo lo que tu empresa necesita,<br />adaptado a Panamá
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 500, margin: "0 auto" }}>Sin módulos genéricos de otros países. Cada función pensada para la legislación, bancos e impuestos de Panamá.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{
                background: "#F0F2F8", borderRadius: 14, padding: "28px 24px",
                border: "1px solid transparent", position: "relative",
              }}>
                {f.pronto && (
                  <span style={{
                    position: "absolute", top: 14, right: 14,
                    background: "#F5A62322", color: "#F5A623", fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>Próximamente</span>
                )}
                <div style={{ fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0D1B2A", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" ref={pricingRef} style={{ padding: "100px 48px", background: "#0D1B2A" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", background: "rgba(0,200,150,0.12)", color: "#00C896", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Precios</div>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", marginBottom: 16 }}>
              Planes simples y transparentes
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Sin contratos, sin sorpresas. Cancela cuando quieras.</p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: !annual ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>Mensual</span>
              <div className={`toggle-track${annual ? " on" : ""}`} onClick={() => setAnnual(!annual)}>
                <div className="toggle-thumb" />
              </div>
              <span style={{ fontSize: 14, color: annual ? "#00C896" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                Anual <span style={{ fontSize: 11, background: "#00C89620", color: "#00C896", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>−20%</span>
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, alignItems: "start" }}>
            {PLANS.map(plan => (
              <div key={plan.id} className="plan-card" style={{
                background: plan.popular ? "#fff" : "rgba(255,255,255,0.04)",
                border: plan.popular ? "2px solid #00C896" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "28px 22px",
                position: "relative",
              }}>
                {plan.popular && <div className="badge-popular">⭐ Más popular</div>}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: plan.color }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: plan.popular ? "#0D1B2A" : "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>{plan.name}</span>
                  </div>
                  <p style={{ fontSize: 12, color: plan.popular ? "#6B7280" : "rgba(255,255,255,0.4)" }}>{plan.desc}</p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: plan.popular ? "#0D1B2A" : "#fff", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.03em" }}>
                      B/. {annual ? plan.annual : plan.price}
                    </span>
                    <span style={{ fontSize: 13, color: plan.popular ? "#9CA3AF" : "rgba(255,255,255,0.35)", marginBottom: 8 }}>/mes</span>
                  </div>
                  {annual && <div style={{ fontSize: 11, color: "#00C896", fontWeight: 600 }}>Ahorras B/. {(plan.price - plan.annual) * 12}/año</div>}
                </div>

                <div style={{ fontSize: 11, color: "#00C896", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
                  ✓ 14 días gratis · Sin tarjeta de crédito
                </div>
                <button
                  className="btn-primary"
                  onClick={() => openPayment(plan)}
                  style={{
                    width: "100%", marginBottom: 24, fontSize: 13,
                    background: plan.popular ? "#00C896" : "rgba(255,255,255,0.08)",
                    boxShadow: plan.popular ? "0 4px 20px rgba(0,200,150,0.35)" : "none",
                    border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                >
                  {plan.id === "enterprise" ? "Contactar ventas" : "Comenzar prueba gratis"}
                </button>

                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <CheckIcon color={plan.color} />
                      <span style={{ fontSize: 12, color: plan.popular ? "#374151" : "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <XIcon />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Métodos de pago aceptados</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {["💳 Visa / Mastercard", "📱 Yappy", "🏦 ACH Panamá", "💲 Stripe", "🅿️ PayPal"].map(m => (
                <div key={m} style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500,
                }}>{m}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "100px 48px", background: "#F7F8FC" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0D1B2A", letterSpacing: "-0.025em" }}>Lo que dicen nuestros clientes</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #E5E7EB", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 20, color: "#00C896", marginBottom: 12, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #00C896, #1A6BF5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff",
                  }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0D1B2A" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0D1B2A", letterSpacing: "-0.025em" }}>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "#00C896", flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                </div>
                {openFaq === i && (
                  <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, marginTop: 10, paddingRight: 32 }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{
        padding: "100px 48px",
        background: "linear-gradient(135deg, #0D1B2A 0%, #0F2744 60%, #0D2E1F 100%)",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,150,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16 }}>
            Listo para modernizar<br />tu empresa
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginBottom: 36, lineHeight: 1.7 }}>
            Únete a empresas panameñas que ya automatizan su contabilidad, facturación y nómina con Gestar ERP.
          </p>
          <button className="btn-primary" style={{ fontSize: 16, padding: "16px 44px" }} onClick={scrollToPricing}>
            Empezar 14 días gratis →
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#060C14", padding: "40px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #00C896, #1A6BF5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>G</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Gestar ERP · Gestar Consultores</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <Link to="/terminos"   style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontWeight: 500 }}>Términos</Link>
          <Link to="/privacidad" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontWeight: 500 }}>Privacidad</Link>
          <a href="mailto:soporte@gestar-erp.com" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontWeight: 500 }}>Soporte</a>
          <a href="https://wa.me/50700000000" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontWeight: 500 }}>WhatsApp</a>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2025 Gestar Consultores · Torre Banesco, Piso 19, Panamá</span>
      </footer>

      {/* PAYMENT MODAL */}
      {payModal && selectedPlan && (
        <div className="modal-overlay" onClick={() => setPayModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, padding: 36, width: "100%", maxWidth: 480,
            boxShadow: "0 40px 120px rgba(0,0,0,0.3)", margin: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Suscripción</div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: "#0D1B2A" }}>Plan {selectedPlan.name}</h3>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#00C896", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                  B/. {annual ? selectedPlan.annual : selectedPlan.price}<span style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 400 }}>/mes</span>
                </div>
              </div>
              <button onClick={() => setPayModal(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Método de pago</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { id: "card", label: "💳 Tarjeta", sub: "Visa / MC" },
                  { id: "yappy", label: "📱 Yappy", sub: "Instantáneo" },
                  { id: "ach", label: "🏦 ACH", sub: "Transferencia" },
                ].map(m => (
                  <div
                    key={m.id}
                    className="pay-method"
                    onClick={() => setPayMethod(m.id)}
                    style={{
                      border: `2px solid ${payMethod === m.id ? "#00C896" : "#E5E7EB"}`,
                      background: payMethod === m.id ? "#E6FAF5" : "#fff",
                      padding: "12px 8px", textAlign: "center", cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 3 }}>{m.label.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: payMethod === m.id ? "#00A87E" : "#4B5563" }}>{m.label.split(" ").slice(1).join(" ")}</div>
                    <div style={{ fontSize: 9, color: "#9CA3AF" }}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {payMethod === "card" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Nombre completo", placeholder: "Como aparece en la tarjeta" },
                  { label: "Número de tarjeta", placeholder: "•••• •••• •••• ••••" },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                    <input placeholder={f.placeholder} style={{
                      width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB",
                      borderRadius: 8, fontSize: 14, color: "#111827", fontFamily: "'Outfit', sans-serif",
                      outline: "none",
                    }} />
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[{ label: "Vencimiento", placeholder: "MM / AA" }, { label: "CVV", placeholder: "•••" }].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                      <input placeholder={f.placeholder} style={{
                        width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB",
                        borderRadius: 8, fontSize: 14, color: "#111827", fontFamily: "'Outfit', sans-serif", outline: "none",
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {payMethod === "yappy" && (
              <div style={{ textAlign: "center", padding: "24px 0 20px", border: "1.5px dashed #E5E7EB", borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1B2A", marginBottom: 4 }}>Pago por Yappy</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>Al confirmar, recibirás un enlace de pago<br />Yappy en tu WhatsApp registrado.</div>
              </div>
            )}

            {payMethod === "ach" && (
              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "16px 18px", marginBottom: 20, border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Datos para transferencia ACH:</div>
                {[["Banco", "Banco General"], ["Cuenta", "04-78-01-123456-7"], ["Beneficiario", "Gestar Consultores S.A."], ["Referencia", `GERP-${selectedPlan.id.toUpperCase()}`]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{k}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", fontFamily: "'DM Mono', monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width: "100%", fontSize: 15, padding: "14px" }}
              onClick={() => navigate(`/registro?plan=${selectedPlan.id}`)}
            >
              {payMethod === "yappy" ? "Enviar enlace Yappy →" : payMethod === "ach" ? "Confirmar y crear cuenta →" : `Continuar con plan ${selectedPlan.name} →`}
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>
              🔒 Pago seguro · Sin contratos · Cancela cuando quieras
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
