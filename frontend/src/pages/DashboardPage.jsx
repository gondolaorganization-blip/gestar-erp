import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MES_ABREV = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

const fmt = (n) =>
  `B/. ${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const ESTADO_LABEL = {
  PAGADA: "Pagada", PENDIENTE: "Pendiente",
  VENCIDA: "Vencida", ANULADA: "Anulada",
};

function diasRestantes(fechaVence, estado) {
  if (estado === "PAGADA" || estado === "ANULADA" || !fechaVence) return null;
  return Math.ceil((new Date(fechaVence) - Date.now()) / 86400000);
}

function buildKpis(d) {
  const totalGastos = (d.gastosPorCategoria ?? []).reduce((s, g) => s + g.monto, 0);
  const proximoVence = d.cartera.porVencer[0];
  return [
    {
      label: "Ingresos del Mes",
      value: fmt(d.facturacion.totalFacturado),
      change: `${d.facturacion.cantidadFacturas} facturas`,
      up: true,
      color: "#00C896",
    },
    {
      label: "Gastos del Mes",
      value: fmt(totalGastos),
      change: `${d.gastosPorCategoria?.length ?? 0} categorías`,
      up: false,
      color: "#FF6B6B",
    },
    {
      label: "Cuentas x Cobrar",
      value: fmt(d.facturacion.porCobrar),
      change: d.cartera.vencidas.cantidad > 0
        ? `${d.cartera.vencidas.cantidad} vencidas`
        : `${d.facturacion.cantidadFacturas} facturas`,
      up: d.cartera.vencidas.cantidad === 0,
      color: "#4E9AF1",
    },
    {
      label: "ITBMS Pendiente",
      value: fmt(d.tesoreria.itbmsPorPagar),
      change: proximoVence
        ? `Vence en ${proximoVence.diasRestantes}d`
        : "Al día",
      up: false,
      color: "#F5A623",
    },
  ];
}

function buildAlertas(d) {
  const lista = [];
  if (d.cartera.vencidas.cantidad > 0) {
    lista.push({
      tipo: "urgente",
      msg: `${d.cartera.vencidas.cantidad} facturas vencidas — recuperar ${fmt(d.cartera.vencidas.monto)}`,
    });
  }
  d.cartera.porVencer.slice(0, 2).forEach((f) => {
    lista.push({
      tipo: "aviso",
      msg: `${f.cliente} vence en ${f.diasRestantes}d — ${fmt(f.monto)}`,
    });
  });
  if (d.tesoreria.itbmsPorPagar > 0) {
    lista.push({
      tipo: "aviso",
      msg: `ITBMS por pagar: ${fmt(d.tesoreria.itbmsPorPagar)}`,
    });
  }
  if (lista.length === 0) {
    lista.push({ tipo: "info", msg: "Todo al día — sin alertas pendientes ✓" });
  }
  return lista;
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", icon: "▦", label: "Dashboard" },
  { id: "facturacion", icon: "◈", label: "Facturación" },
  { id: "clientes",    icon: "◉", label: "Clientes" },
  { id: "contabilidad", icon: "≡", label: "Contabilidad" },
  { id: "cobrar", icon: "↗", label: "Cuentas x Cobrar" },
  { id: "pagar", icon: "↙", label: "Cuentas x Pagar" },
  { id: "inventario", icon: "⊟", label: "Inventario" },
  { id: "crm", icon: "◎", label: "CRM / Leads" },
  { id: "nomina", icon: "⊕", label: "Nómina Panamá" },
  { id: "impuestos", icon: "⊠", label: "Impuestos / DGI" },
  { id: "reportes", icon: "⊞", label: "Reportes" },
  { id: "ia", icon: "✦", label: "Asistente IA" },
  { id: "importacion",   icon: "⬆", label: "Importar Banco" },
  { id: "proveedores",   icon: "⊖", label: "Proveedores" },
  { id: "productos",     icon: "⊟", label: "Productos y Servicios" },
  { id: "configuracion", icon: "⚙", label: "Configuración" },
];

// ── Chart components ──────────────────────────────────────────────────────────

function MiniBarChart({ ingresos, gastos, meses }) {
  const max = Math.max(...ingresos, ...gastos, 1);
  return (
    <div style={{ width: "100%", paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
        {meses.map((mes, i) => (
          <div key={mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
              <div style={{
                flex: 1,
                background: i === meses.length - 1 ? "#00C896" : "rgba(0,200,150,0.35)",
                borderRadius: "3px 3px 0 0",
                height: `${(ingresos[i] / max) * 100}%`,
                transition: "height 0.6s cubic-bezier(0.4,0,0.2,1)",
              }} />
              {gastos[i] > 0 && (
                <div style={{
                  flex: 1,
                  background: i === meses.length - 1 ? "#FF6B6B" : "rgba(255,107,107,0.3)",
                  borderRadius: "3px 3px 0 0",
                  height: `${(gastos[i] / max) * 100}%`,
                  transition: "height 0.6s cubic-bezier(0.4,0,0.2,1)",
                }} />
              )}
            </div>
            <span style={{ fontSize: 9, color: "#6B7A99", letterSpacing: "0.02em" }}>{mes}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        {[["#00C896", "Ingresos"], ["#FF6B6B", "Gastos"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: "#8A94B0" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ value = 0 }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div style={{ position: "relative", width: 110, height: 110 }}>
      <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(78,154,241,0.12)" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={r}
          fill="none" stroke="#4E9AF1" strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#E8EDFF", fontFamily: "'DM Mono', monospace" }}>{value}%</span>
        <span style={{ fontSize: 9, color: "#6B7A99", letterSpacing: "0.08em", textTransform: "uppercase" }}>cobrado</span>
      </div>
    </div>
  );
}

const estadoColor = { Pagada: "#00C896", Pendiente: "#F5A623", Vencida: "#FF6B6B", Anulada: "#6B7A99" };

// ── Main Component ────────────────────────────────────────────────────────────

export default function ERPPanama() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  const [activeNav, setActiveNav] = useState("dashboard");
  const isMobile = () => window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [mounted, setMounted] = useState(false);

  // Dashboard data
  const [kpis, setKpis] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [chartMeses, setChartMeses] = useState([]);
  const [chartIngresos, setChartIngresos] = useState([]);
  const [chartGastos, setChartGastos] = useState([]);
  const [cobradoPct, setCobradoPct] = useState(0);
  const [cobradoDetalle, setCobradoDetalle] = useState([]);
  const [itbmsMes, setItbmsMes] = useState(0);
  const [loading, setLoading] = useState(true);

  // Trial
  const [diasTrial, setDiasTrial] = useState(null);

  // AI assistant
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Hola. Soy tu asistente financiero con acceso a tus datos en tiempo real. Puedo analizar tus finanzas, explicar estados de cuenta, proyectar flujo de caja o responder consultas contables de Panamá. ¿En qué te ayudo hoy?", _initial: true },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [dashRes, facturasRes, perfilRes] = await Promise.all([
          api.get("/dashboard"),
          api.get("/facturas?limite=5"),
          api.get("/auth/me"),
        ]);

        const d = dashRes.data;

        // KPIs
        setKpis(buildKpis(d));

        // Alertas
        setAlertas(buildAlertas(d));

        // Chart — tendencia mensual
        const trend = d.tendenciaMensual ?? [];
        setChartMeses(trend.map((m) => MES_ABREV[m.mes.slice(5)] ?? m.mes.slice(5)));
        setChartIngresos(trend.map((m) => m.facturado));
        setChartGastos(new Array(trend.length).fill(0));

        // Donut — efectividad de cobro
        const total = d.facturacion.totalFacturado;
        const cobrado = d.facturacion.totalCobrado;
        const pct = total > 0 ? Math.round((cobrado / total) * 100) : 0;
        setCobradoPct(pct);
        const porCobrar = d.facturacion.porCobrar;
        const vencido = d.cartera.vencidas.monto;
        setCobradoDetalle([
          { label: "Cobrado", val: fmt(cobrado), color: "#4E9AF1" },
          { label: "Pendiente", val: fmt(porCobrar - vencido), color: "#F5A623" },
          { label: "Vencido", val: fmt(vencido), color: "#FF6B6B" },
        ]);

        // ITBMS card
        setItbmsMes(d.tesoreria.itbmsPorPagar);

        // Trial
        const empresa = perfilRes.data?.empresa;
        if (empresa?.plan === 'TRIAL' && empresa?.diasRestantes !== null) {
          setDiasTrial(empresa.diasRestantes);
        }

        // Facturas recientes
        const raw = facturasRes.data.datos ?? [];
        setFacturas(raw.map((f) => ({
          id: f.numero,
          cliente: f.cliente?.nombre ?? "—",
          monto: fmt(f.total),
          estado: ESTADO_LABEL[f.estado] ?? f.estado,
          dias: diasRestantes(f.fechaVence, f.estado),
        })));
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");

    const updatedMessages = [...aiMessages, { role: "user", text: userMsg }];
    setAiMessages(updatedMessages);
    setAiLoading(true);

    try {
      // Enviar historial completo al proxy del backend (excluye el saludo inicial del asistente)
      const historial = updatedMessages
        .filter((m) => !(m.role === "assistant" && m._initial))
        .map((m) => ({ role: m.role, content: m.text }));

      const { data } = await api.post("/ai/chat", { messages: historial });
      setAiMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
    } catch (err) {
      const msg = err.response?.data?.error ?? "Error de conexión. Intenta nuevamente.";
      setAiMessages((prev) => [...prev, { role: "assistant", text: msg }]);
    }
    setAiLoading(false);
  };

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');`;

  // Alerta count for header badge
  const alertasUrgentes = alertas.filter((a) => a.tipo === "urgente" || a.tipo === "aviso").length;

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", background: "#0D1117", minHeight: "100vh", color: "#E8EDFF", display: "flex", overflow: "hidden" }}>
      <style>{`
        ${fonts}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .nav-item { cursor: pointer; transition: all 0.18s ease; border-radius: 8px; }
        .nav-item:hover { background: rgba(78,154,241,0.12); }
        .nav-item.active { background: rgba(78,154,241,0.18); }
        .kpi-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .factura-row:hover { background: rgba(255,255,255,0.03); }
        .send-btn:hover { background: #3D7FD8 !important; }
        .ai-input:focus { outline: none; border-color: rgba(78,154,241,0.5) !important; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .pulse { animation: pulse 1.2s ease infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        @media (max-width: 767px) {
          .sidebar-overlay { display: block !important; }
          .sidebar-mobile { position: fixed !important; top: 0; left: 0; height: 100vh; z-index: 200; }
          .main-mobile { padding: 16px 14px 32px !important; }
          .kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-2col { grid-template-columns: 1fr !important; }
          .hamburger-btn { display: block !important; }
        }
      `}</style>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: "none",
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 199,
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside className="sidebar-mobile" style={{
        width: sidebarOpen ? 220 : 64,
        background: "#0A0D13",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column", padding: "20px 0",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        flexShrink: 0, overflow: "hidden", zIndex: 10,
      }}>
        <div style={{ padding: "0 16px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #4E9AF1 0%, #00C896 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>G</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#E8EDFF", letterSpacing: "0.02em" }}>GESTAR ERP</div>
              <div style={{ fontSize: 9, color: "#4E9AF1", letterSpacing: "0.12em", textTransform: "uppercase" }}>Panamá</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            marginLeft: "auto", background: "none", border: "none", color: "#4B5675",
            cursor: "pointer", fontSize: 14, padding: 2, flexShrink: 0,
          }}>{sidebarOpen ? "◂" : "▸"}</button>
        </div>

        <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`nav-item${activeNav === item.id ? " active" : ""}`}
              onClick={() => {
                const rutas = {
                  inventario:    "/inventario",
                  nomina:        "/nomina",
                  crm:           "/crm",
                  clientes:      "/clientes",
                  facturacion:   "/facturacion",
                  cobrar:        "/cobrar",
                  pagar:         "/pagar",
                  reportes:      "/reportes",
                  contabilidad:  "/contabilidad",
                  impuestos:      "/impuestos",
                  importacion:    "/importacion-bancaria",
                  proveedores:    "/proveedores",
                  productos:      "/productos",
                  configuracion:  "/configuracion",
                };
                if (rutas[item.id]) { if (isMobile()) setSidebarOpen(false); return navigate(rutas[item.id]); }
                setActiveNav(item.id);
                if (isMobile()) setSidebarOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                color: activeNav === item.id ? "#4E9AF1" : "#6B7A99",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, width: 16, textAlign: "center" }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 12px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #4E9AF1, #00C896)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              {(usuario.nombre ?? "U").slice(0, 2).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#E8EDFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {usuario.nombre ?? "Usuario"}
                </div>
                <button onClick={handleLogout} style={{
                  background: "none", border: "none", color: "#4B5675", cursor: "pointer",
                  fontSize: 9, padding: 0, fontFamily: "'Syne', sans-serif",
                }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-mobile" style={{ flex: 1, overflow: "auto", padding: "28px 28px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              style={{
                display: "none", background: "rgba(255,255,255,0.07)", border: "none",
                color: "#E8EDFF", borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                fontSize: 16, lineHeight: 1,
              }}
              className="hamburger-btn"
            >☰</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E8EDFF", letterSpacing: "-0.02em" }}>
              {activeNav === "dashboard" && "Dashboard Ejecutivo"}
              {activeNav === "facturacion" && "Facturación Electrónica"}
              {activeNav === "ia" && "✦ Asistente IA Financiero"}
              {activeNav === "contabilidad" && "Contabilidad General"}
              {activeNav === "impuestos" && "Impuestos / DGI Panamá"}
              {activeNav === "nomina" && "Nómina Panamá"}
              {activeNav === "cobrar" && "Cuentas por Cobrar"}
              {activeNav === "pagar" && "Cuentas por Pagar"}
              {activeNav === "inventario" && "Inventario"}
              {activeNav === "crm" && "CRM / Pipeline Comercial"}
              {activeNav === "reportes" && "Reportes & Analytics"}
            </h1>
            <p style={{ fontSize: 12, color: "#4B5675", marginTop: 2 }}>
              {new Date().toLocaleString("es-PA", { month: "long", year: "numeric" })} · {usuario.empresa ?? "Gestar Consultores"}
            </p>
          </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {alertasUrgentes > 0 && (
              <div style={{
                background: "#FF6B6B22", border: "1px solid #FF6B6B44", borderRadius: 20,
                padding: "5px 12px", fontSize: 11, color: "#FF6B6B", fontWeight: 600, cursor: "pointer",
              }}>
                ⚠ {alertasUrgentes} alertas
              </div>
            )}
            <div style={{
              background: "rgba(78,154,241,0.12)", border: "1px solid rgba(78,154,241,0.2)",
              borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#4E9AF1", fontWeight: 600, cursor: "pointer",
            }}>
              + Nueva Factura
            </div>
          </div>
        </div>

        {/* ======================== TRIAL BANNER ======================== */}
        {diasTrial !== null && (
          <div style={{
            background: diasTrial <= 3 ? "rgba(255,107,107,0.12)" : "rgba(245,166,35,0.10)",
            border: `1px solid ${diasTrial <= 3 ? "rgba(255,107,107,0.3)" : "rgba(245,166,35,0.25)"}`,
            borderRadius: 10, padding: "10px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          }}>
            <span style={{ fontSize: 13, color: diasTrial <= 3 ? "#FF6B6B" : "#F5A623", fontWeight: 600 }}>
              {diasTrial === 0
                ? "⚠ Tu período de prueba vence hoy"
                : `⏳ Te quedan ${diasTrial} día${diasTrial === 1 ? "" : "s"} de prueba gratuita`}
            </span>
            <a
              href="mailto:gondola.organization@gmail.com?subject=Activar%20plan%20GESTAR%20ERP"
              style={{ fontSize: 12, color: "#4E9AF1", fontWeight: 600, textDecoration: "none" }}
            >
              Activar plan →
            </a>
          </div>
        )}

        {/* ======================== LOADING ======================== */}
        {loading && activeNav === "dashboard" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
            <div style={{ textAlign: "center" }}>
              <div className="spin" style={{ width: 32, height: 32, border: "3px solid rgba(78,154,241,0.2)", borderTopColor: "#4E9AF1", borderRadius: "50%", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 12, color: "#4B5675" }}>Cargando datos del servidor...</div>
            </div>
          </div>
        )}

        {/* ======================== DASHBOARD ======================== */}
        {!loading && activeNav === "dashboard" && (
          <div className="fade-up">
            {/* KPIs */}
            <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
              {kpis.map((k) => (
                <div key={k.label} className="kpi-card" style={{
                  background: "#111620", border: `1px solid ${k.color}22`, borderRadius: 12, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 10, color: "#6B7A99", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#E8EDFF", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{k.value}</div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: k.color, fontWeight: 700 }}>{k.change}</span>
                    <span style={{ fontSize: 10, color: k.color }}>{k.up ? "↑" : "↓"}</span>
                  </div>
                  <div style={{ marginTop: 10, height: 2, background: `${k.color}22`, borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: k.up ? "72%" : "41%", background: k.color, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="dashboard-2col" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 20 }}>
              <div style={{ background: "#111620", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EDFF" }}>Ingresos vs Gastos</div>
                    <div style={{ fontSize: 10, color: "#4B5675" }}>Últimos {chartMeses.length} meses</div>
                  </div>
                </div>
                {chartMeses.length > 0
                  ? <MiniBarChart ingresos={chartIngresos} gastos={chartGastos} meses={chartMeses} />
                  : <div style={{ color: "#4B5675", fontSize: 12, marginTop: 20 }}>Sin datos de tendencia aún.</div>
                }
              </div>

              <div style={{ background: "#111620", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EDFF", marginBottom: 4 }}>Efectividad de Cobro</div>
                <div style={{ fontSize: 10, color: "#4B5675", marginBottom: 16 }}>
                  {new Date().toLocaleString("es-PA", { month: "long", year: "numeric" })}
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <DonutChart value={cobradoPct} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cobradoDetalle.map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: r.color }} />
                        <span style={{ fontSize: 11, color: "#8A94B0" }}>{r.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#E8EDFF", fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Facturas + Alertas */}
            <div className="dashboard-2col" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
              <div style={{ background: "#111620", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EDFF" }}>Facturas Recientes</div>
                  <span style={{ fontSize: 10, color: "#4E9AF1", cursor: "pointer" }}>Ver todas →</span>
                </div>
                {facturas.length === 0
                  ? <div style={{ color: "#4B5675", fontSize: 12 }}>Sin facturas registradas aún.</div>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          {["Número", "Cliente", "Monto", "Estado", "Días"].map((h) => (
                            <th key={h} style={{ textAlign: "left", fontSize: 9, color: "#4B5675", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 10 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {facturas.map((f) => (
                          <tr key={f.id} className="factura-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}>
                            <td style={{ padding: "10px 0", fontSize: 11, color: "#4E9AF1", fontFamily: "'DM Mono', monospace" }}>{f.id}</td>
                            <td style={{ fontSize: 11, color: "#C8D0E8" }}>{f.cliente}</td>
                            <td style={{ fontSize: 11, color: "#E8EDFF", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{f.monto}</td>
                            <td>
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                                color: estadoColor[f.estado] ?? "#8A94B0",
                                background: `${estadoColor[f.estado] ?? "#8A94B0"}18`,
                                border: `1px solid ${estadoColor[f.estado] ?? "#8A94B0"}33`,
                                borderRadius: 20, padding: "2px 8px",
                              }}>{f.estado}</span>
                            </td>
                            <td style={{ fontSize: 11, color: f.dias < 0 ? "#FF6B6B" : "#8A94B0", fontFamily: "'DM Mono', monospace" }}>
                              {f.dias === null ? "—" : f.dias < 0 ? `${Math.abs(f.dias)}d venc.` : `${f.dias}d`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>

              <div style={{ background: "#111620", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EDFF", marginBottom: 16 }}>Alertas del Sistema</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {alertas.map((a, i) => (
                    <div key={i} style={{
                      background: a.tipo === "urgente" ? "#FF6B6B0A" : a.tipo === "aviso" ? "#F5A6230A" : "#4E9AF10A",
                      border: `1px solid ${a.tipo === "urgente" ? "#FF6B6B22" : a.tipo === "aviso" ? "#F5A62322" : "#4E9AF122"}`,
                      borderRadius: 8, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 12, marginTop: 1, flexShrink: 0 }}>
                          {a.tipo === "urgente" ? "⚠" : a.tipo === "aviso" ? "◉" : "ℹ"}
                        </span>
                        <span style={{ fontSize: 11, color: "#B8C4DF", lineHeight: 1.5 }}>{a.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: "12px", background: "#F5A6230A", border: "1px solid #F5A62322", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#F5A623", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>ITBMS Mes</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#E8EDFF", fontFamily: "'DM Mono', monospace" }}>{fmt(itbmsMes)}</div>
                  <div style={{ fontSize: 10, color: "#8A94B0", marginTop: 2 }}>Por pagar (tesorería)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================== AI ASSISTANT ======================== */}
        {activeNav === "ia" && (
          <div className="fade-up" style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{
              background: "#111620", border: "1px solid rgba(78,154,241,0.15)",
              borderRadius: 16, overflow: "hidden", height: "calc(100vh - 160px)", display: "flex", flexDirection: "column",
            }}>
              <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                {aiMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    {m.role === "assistant" && (
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "linear-gradient(135deg, #4E9AF1, #00C896)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "#fff", fontWeight: 800, marginRight: 10, flexShrink: 0, marginTop: 2,
                      }}>✦</div>
                    )}
                    <div style={{
                      maxWidth: "75%", padding: "12px 16px",
                      borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                      background: m.role === "user" ? "rgba(78,154,241,0.18)" : "rgba(255,255,255,0.04)",
                      border: m.role === "user" ? "1px solid rgba(78,154,241,0.25)" : "1px solid rgba(255,255,255,0.06)",
                      fontSize: 13, color: "#C8D0E8", lineHeight: 1.6,
                    }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "linear-gradient(135deg, #4E9AF1, #00C896)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff", fontWeight: 800,
                    }}>✦</div>
                    <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "4px 16px 16px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {[0, 1, 2].map((d) => (
                        <div key={d} className="pulse" style={{
                          width: 6, height: 6, borderRadius: "50%", background: "#4E9AF1",
                          animationDelay: `${d * 0.2}s`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: "0 24px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["¿Cuál es mi flujo de caja?", "Explica el ITBMS pendiente", "¿Qué facturas están vencidas?", "Proyección financiera del mes"].map((s) => (
                  <button key={s} onClick={() => setAiInput(s)} style={{
                    background: "rgba(78,154,241,0.08)", border: "1px solid rgba(78,154,241,0.2)",
                    borderRadius: 20, padding: "4px 12px", fontSize: 10, color: "#4E9AF1", cursor: "pointer",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600,
                  }}>{s}</button>
                ))}
              </div>

              <div style={{ padding: "12px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 10 }}>
                <input
                  className="ai-input"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAI()}
                  placeholder="Pregunta sobre tus finanzas, impuestos, facturas..."
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: "11px 16px", fontSize: 13, color: "#E8EDFF",
                    fontFamily: "'Syne', sans-serif",
                  }}
                />
                <button className="send-btn" onClick={sendAI} disabled={aiLoading} style={{
                  background: "#4E9AF1", border: "none", borderRadius: 10,
                  padding: "0 18px", fontSize: 14, color: "#fff", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, transition: "background 0.15s",
                  opacity: aiLoading ? 0.6 : 1,
                }}>→</button>
              </div>
            </div>
          </div>
        )}

        {/* ======================== MODULES PLACEHOLDER ======================== */}
        {!["dashboard", "ia"].includes(activeNav) && (
          <div className="fade-up">
            <div style={{
              background: "#111620", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 16, padding: 48, textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>
                {NAV_ITEMS.find((n) => n.id === activeNav)?.icon}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#E8EDFF", marginBottom: 8 }}>
                {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
              </div>
              <div style={{ fontSize: 13, color: "#4B5675", maxWidth: 380, margin: "0 auto", lineHeight: 1.7 }}>
                Módulo en desarrollo. Esta sección estará disponible en la Fase{" "}
                {["cobrar", "pagar", "contabilidad", "facturacion", "impuestos"].includes(activeNav) ? "1" :
                  ["nomina", "inventario", "crm"].includes(activeNav) ? "2" : "3"}
                {" "}del roadmap GESTAR ERP.
              </div>
              <div style={{
                display: "inline-flex", marginTop: 20, gap: 8,
                background: "rgba(78,154,241,0.08)", border: "1px solid rgba(78,154,241,0.2)",
                borderRadius: 20, padding: "6px 16px", fontSize: 11, color: "#4E9AF1", fontWeight: 600,
              }}>
                Fase {["cobrar", "pagar", "contabilidad", "facturacion", "impuestos"].includes(activeNav) ? "1" : ["nomina", "inventario", "crm"].includes(activeNav) ? "2" : "3"} · Roadmap activo
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
