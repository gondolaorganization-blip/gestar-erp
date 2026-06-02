import { useState, useEffect, useCallback } from "react";

// Página de super-administración de GestarSoft.
// No usa el JWT de usuario: se autentica con la clave ADMIN_SECRET (cabecera x-admin-key).
// Por eso usa fetch directo y NO el cliente `api` (que redirige a /login ante 401).

const API = import.meta.env.VITE_API_URL || "/api";

const PLANES = ["TRIAL", "EMPRENDE", "BASICO", "PROFESIONAL", "DESPACHO", "ENTERPRISE"];

const COLOR_PLAN = {
  TRIAL:       "#94A3B8",
  EMPRENDE:    "#90CAF9",
  BASICO:      "#64B5F6",
  PROFESIONAL: "#00C896",
  DESPACHO:    "#F5A623",
  ENTERPRISE:  "#E879F9",
};

async function adminFetch(key, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-key": key, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");

export default function SuperAdminPage() {
  const [key, setKey] = useState(sessionStorage.getItem("adminKey") || "");
  const [autenticado, setAutenticado] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async (k) => {
    setCargando(true);
    setError("");
    try {
      const data = await adminFetch(k, "/admin/empresas");
      setEmpresas(Array.isArray(data) ? data : []);
      setAutenticado(true);
      sessionStorage.setItem("adminKey", k);
    } catch (e) {
      setError(e.message);
      setAutenticado(false);
      sessionStorage.removeItem("adminKey");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (key) cargar(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg) => { setAviso(msg); setTimeout(() => setAviso(""), 3000); };

  async function cambiarPlan(id, plan) {
    try {
      await adminFetch(key, `/admin/empresas/${id}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) });
      flash(`Plan actualizado a ${plan}`);
      cargar(key);
    } catch (e) { setError(e.message); }
  }

  async function extenderTrial(id, dias) {
    try {
      await adminFetch(key, `/admin/empresas/${id}/trial`, { method: "PATCH", body: JSON.stringify({ dias }) });
      flash(`Trial extendido ${dias} días`);
      cargar(key);
    } catch (e) { setError(e.message); }
  }

  function salir() {
    sessionStorage.removeItem("adminKey");
    setAutenticado(false);
    setEmpresas([]);
    setKey("");
  }

  // ── Pantalla de acceso ────────────────────────────────────────────────────
  if (!autenticado) {
    return (
      <div style={st.gate}>
        <div style={st.gateCard}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0D1B2A", margin: "0 0 4px" }}>Super Admin</h1>
          <p style={{ color: "#6B7280", fontSize: 14, margin: "0 0 20px" }}>GestarSoft — Gestar ERP</p>
          <input
            style={st.input}
            type="password"
            placeholder="ADMIN_SECRET"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cargar(key)}
          />
          <button style={st.btnPrimary} disabled={!key || cargando} onClick={() => cargar(key)}>
            {cargando ? "Verificando…" : "Entrar"}
          </button>
          {error && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  const filtradas = empresas.filter((e) => {
    const q = busqueda.toLowerCase();
    return !q
      || e.nombre?.toLowerCase().includes(q)
      || e.ruc?.toLowerCase().includes(q)
      || e.email?.toLowerCase().includes(q)
      || e.usuarios?.some((u) => u.email?.toLowerCase().includes(q));
  });

  const stats = {
    total: empresas.length,
    activas: empresas.filter((e) => e.activa).length,
    trial: empresas.filter((e) => e.plan === "TRIAL").length,
    pagas: empresas.filter((e) => e.plan !== "TRIAL").length,
  };

  return (
    <div style={st.wrap}>
      <div style={st.topbar}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Super Admin · GestarSoft</h1>
          <p style={{ color: "#94A3B8", fontSize: 13, margin: "2px 0 0" }}>
            {stats.total} empresas · {stats.pagas} con plan · {stats.trial} en trial · {stats.activas} activas
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={st.btnGhost} onClick={() => cargar(key)} disabled={cargando}>↻ Refrescar</button>
          <button style={st.btnGhost} onClick={salir}>Salir</button>
        </div>
      </div>

      {aviso && <div style={st.aviso}>✅ {aviso}</div>}
      {error && <div style={st.errorBar}>⚠️ {error}</div>}

      <input
        style={{ ...st.input, maxWidth: 360, margin: "0 0 16px" }}
        placeholder="Buscar por empresa, RUC o email…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div style={{ display: "grid", gap: 14 }}>
        {filtradas.map((e) => (
          <EmpresaCard key={e.id} e={e} onPlan={cambiarPlan} onTrial={extenderTrial} />
        ))}
        {filtradas.length === 0 && <p style={{ color: "#94A3B8" }}>Sin resultados.</p>}
      </div>
    </div>
  );
}

function EmpresaCard({ e, onPlan, onTrial }) {
  const [plan, setPlan] = useState(e.plan);
  const [dias, setDias] = useState(30);

  return (
    <div style={st.card}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 16 }}>{e.nombre}</strong>
            <span style={{ ...st.badge, background: COLOR_PLAN[e.plan] || "#94A3B8" }}>{e.plan}</span>
            {!e.activa && <span style={{ ...st.badge, background: "#EF4444" }}>INACTIVA</span>}
          </div>
          <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>
            RUC {e.ruc} · {e.email || "sin email"} · creada {fmtFecha(e.creadoEn)}
            {e.diasRestantes != null && <> · trial: <strong>{e.diasRestantes} días</strong></>}
            {e.paypalSubscriptionId && <> · PayPal ✓</>}
          </div>
        </div>
      </div>

      {/* Usuarios */}
      <div style={st.usuariosBox}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#94A3B8", marginBottom: 6 }}>
          Usuarios ({e.usuarios?.length || 0})
        </div>
        {(e.usuarios || []).map((u) => (
          <div key={u.id} style={st.usuarioRow}>
            <span style={{ fontWeight: 600 }}>{u.nombre}</span>
            <span style={{ color: "#2563EB" }}>{u.email}</span>
            <span style={{ color: "#94A3B8" }}>{u.rol?.nombre}</span>
            <span style={{ color: u.activo ? "#16A34A" : "#EF4444" }}>{u.activo ? "activo" : "inactivo"}</span>
            <span style={{ color: "#94A3B8", fontSize: 12 }}>últ. acceso {fmtFecha(u.ultimoAcceso)}</span>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div style={st.acciones}>
        <div style={st.accionGrupo}>
          <select style={st.select} value={plan} onChange={(ev) => setPlan(ev.target.value)}>
            {PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button style={st.btnSmall} disabled={plan === e.plan} onClick={() => onPlan(e.id, plan)}>
            Aplicar plan
          </button>
        </div>
        <div style={st.accionGrupo}>
          <input
            style={{ ...st.select, width: 70 }}
            type="number" min="1" value={dias}
            onChange={(ev) => setDias(parseInt(ev.target.value) || 0)}
          />
          <span style={{ color: "#94A3B8", fontSize: 13 }}>días</span>
          <button style={st.btnSmallGhost} onClick={() => onTrial(e.id, dias)}>Extender trial</button>
        </div>
      </div>
    </div>
  );
}

const st = {
  gate: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D1B2A", fontFamily: "Syne, sans-serif" },
  gateCard: { background: "#fff", borderRadius: 16, padding: "40px 36px", width: 360, textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,.3)" },
  wrap: { minHeight: "100vh", background: "#0F172A", color: "#E2E8F0", padding: "24px 20px", fontFamily: "Syne, sans-serif", maxWidth: 1100, margin: "0 auto" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, boxSizing: "border-box", marginBottom: 12 },
  btnPrimary: { width: "100%", padding: "11px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnGhost: { padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#E2E8F0", fontSize: 13, cursor: "pointer" },
  card: { background: "#1E293B", borderRadius: 12, padding: 16, border: "1px solid #334155" },
  badge: { color: "#0D1B2A", fontWeight: 800, fontSize: 10, padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em" },
  usuariosBox: { background: "#0F172A", borderRadius: 8, padding: "10px 12px", margin: "12px 0" },
  usuarioRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "4px 0", fontSize: 13, borderBottom: "1px solid #1E293B" },
  acciones: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" },
  accionGrupo: { display: "flex", gap: 8, alignItems: "center" },
  select: { padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0F172A", color: "#E2E8F0", fontSize: 13 },
  btnSmall: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#00C896", color: "#0D1B2A", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnSmallGhost: { padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#E2E8F0", fontSize: 13, cursor: "pointer" },
  aviso: { background: "#064E3B", color: "#6EE7B7", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 14 },
  errorBar: { background: "#7F1D1D", color: "#FCA5A5", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 14 },
};
