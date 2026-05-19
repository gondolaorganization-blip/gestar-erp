import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");
const hoy = () => new Date().toISOString().slice(0, 10);

const TIPO_COLOR = {
  ACTIVO: "#4E9AF1", PASIVO: "#FF6B6B", PATRIMONIO: "#9B59B6",
  INGRESO: "#00C896", GASTO: "#F5A623",
};

const TABS = ["Balance General", "Estado de Resultados", "Libro Diario", "Antigüedad de Cartera"];

// ── Balance General ───────────────────────────────────────────────────────────

function TabBalance() {
  const [al, setAl]       = useState(hoy());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get(`/reportes/balance-general?al=${al}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  function Seccion({ titulo, cuentas, color }) {
    const total = cuentas?.reduce((s, c) => s + c.saldo, 0) ?? 0;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderBottom: `2px solid ${color}`, paddingBottom: 6, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color }}>{titulo}</span>
          <span style={{ fontWeight: 800, fontSize: 15, color }}>{fmt(total)}</span>
        </div>
        {(cuentas ?? []).filter((c) => c.saldo !== 0).map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between",
                                   padding: "5px 0 5px", paddingLeft: (c.nivel - 1) * 16,
                                   borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
            <span style={{ color: "#555" }}>{c.codigo} — {c.nombre}</span>
            <span style={{ fontFamily: "monospace", color: "#1a1a2e" }}>{fmt(c.saldo)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={st.label}>Al (fecha)</label>
          <input style={{ ...st.input, marginBottom: 0, width: 180 }} type="date" value={al} onChange={(e) => setAl(e.target.value)} />
        </div>
        <button onClick={cargar} disabled={loading} style={st.btnPri}>{loading ? "Cargando…" : "Generar"}</button>
        {data && (
          <a href={`${import.meta.env.VITE_API_URL ?? ""}/api/reportes/balance-general/pdf?al=${al}`}
             target="_blank" rel="noreferrer" style={{ ...st.btnSec, textDecoration: "none" }}>↓ PDF</a>
        )}
      </div>

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <Seccion titulo="ACTIVOS" cuentas={data.activos?.cuentas} color={TIPO_COLOR.ACTIVO} />
          </div>
          <div>
            <Seccion titulo="PASIVOS" cuentas={data.pasivos?.cuentas} color={TIPO_COLOR.PASIVO} />
            <Seccion titulo="PATRIMONIO" cuentas={data.patrimonio?.cuentas} color={TIPO_COLOR.PATRIMONIO} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estado de Resultados ──────────────────────────────────────────────────────

function TabResultados() {
  const primerDiaMes = hoy().slice(0, 7) + "-01";
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get(`/reportes/estado-resultados?desde=${desde}&hasta=${hasta}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={st.label}>Desde</label>
          <input style={{ ...st.input, marginBottom: 0, width: 160 }} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={st.label}>Hasta</label>
          <input style={{ ...st.input, marginBottom: 0, width: 160 }} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button onClick={cargar} disabled={loading} style={st.btnPri}>{loading ? "Cargando…" : "Generar"}</button>
        {data && (
          <a href={`${import.meta.env.VITE_API_URL ?? ""}/api/reportes/estado-resultados/pdf?desde=${desde}&hasta=${hasta}`}
             target="_blank" rel="noreferrer" style={{ ...st.btnSec, textDecoration: "none" }}>↓ PDF</a>
        )}
      </div>

      {data && (
        <div style={{ maxWidth: 600 }}>
          {[
            { titulo: "INGRESOS", cuentas: data.ingresos?.cuentas, color: TIPO_COLOR.INGRESO },
            { titulo: "GASTOS",   cuentas: data.gastos?.cuentas,   color: TIPO_COLOR.GASTO   },
          ].map(({ titulo, cuentas, color }) => (
            <div key={titulo} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                            borderBottom: `2px solid ${color}`, paddingBottom: 6, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color }}>{titulo}</span>
                <span style={{ fontWeight: 800, color }}>
                  {fmt((cuentas ?? []).reduce((s, c) => s + c.saldo, 0))}
                </span>
              </div>
              {(cuentas ?? []).filter((c) => c.saldo !== 0).map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between",
                                         padding: "5px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
                  <span style={{ color: "#555" }}>{c.codigo} — {c.nombre}</span>
                  <span style={{ fontFamily: "monospace" }}>{fmt(c.saldo)}</span>
                </div>
              ))}
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "3px solid #1a1a2e",
                        paddingTop: 12, fontWeight: 800, fontSize: 16 }}>
            <span>UTILIDAD / PÉRDIDA</span>
            <span style={{ color: (data.utilidadNeta ?? 0) >= 0 ? "#00C896" : "#FF6B6B" }}>
              {fmt(data.utilidadNeta)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Libro Diario ──────────────────────────────────────────────────────────────

function TabLibroDiario() {
  const primerDiaMes = hoy().slice(0, 7) + "-01";
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get(`/reportes/libro-diario?desde=${desde}&hasta=${hasta}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={st.label}>Desde</label>
          <input style={{ ...st.input, marginBottom: 0, width: 160 }} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={st.label}>Hasta</label>
          <input style={{ ...st.input, marginBottom: 0, width: 160 }} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button onClick={cargar} disabled={loading} style={st.btnPri}>{loading ? "Cargando…" : "Generar"}</button>
      </div>

      {data && (
        <div style={st.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>{["Fecha", "N° Asiento", "Descripción", "Referencia", "Cuenta", "Debe", "Haber"].map((h) => (
                  <th key={h} style={st.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(data.asientos ?? []).length === 0 && (
                  <tr><td colSpan={7} style={{ ...st.td, textAlign: "center", color: "#888", padding: 24 }}>Sin asientos en el período seleccionado</td></tr>
                )}
                {(data.asientos ?? []).map((a) => (
                  (a.lineas ?? []).map((l, li) => (
                    <tr key={`${a.numero}-${li}`} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      {li === 0 && (
                        <>
                          <td style={{ ...st.td, fontSize: 12 }} rowSpan={a.lineas.length}>{fmtFecha(a.fecha)}</td>
                          <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }} rowSpan={a.lineas.length}>{a.numero}</td>
                          <td style={{ ...st.td, fontSize: 12 }} rowSpan={a.lineas.length}>{a.descripcion}</td>
                          <td style={{ ...st.td, fontSize: 12, color: "#888" }} rowSpan={a.lineas.length}>{a.referencia ?? "—"}</td>
                        </>
                      )}
                      <td style={{ ...st.td, paddingLeft: l.debe > 0 ? 14 : 28, fontSize: 13 }}>{l.cuenta ?? "—"}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#4E9AF1" }}>{l.debe > 0 ? fmt(l.debe) : ""}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{l.haber > 0 ? fmt(l.haber) : ""}</td>
                    </tr>
                  ))
                ))}
              </tbody>
              {data.totales && (
                <tfoot>
                  <tr style={{ background: "#f0f4ff", fontWeight: 700 }}>
                    <td colSpan={5} style={{ ...st.td, textAlign: "right", fontSize: 13 }}>TOTALES</td>
                    <td style={{ ...st.td, textAlign: "right", color: "#4E9AF1" }}>{fmt(data.totales.debe)}</td>
                    <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(data.totales.haber)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Antigüedad de Cartera ─────────────────────────────────────────────────────

function TabCartera() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get("/reportes/antiguedad-cartera");
      setData(r.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  const tramos = ["corriente", "dias30", "dias60", "dias90", "mas90"];
  const labels = ["Corriente", "1-30 días", "31-60 días", "61-90 días", "+90 días"];
  const colors = ["#00C896", "#F5A623", "#E67E22", "#FF6B6B", "#C0392B"];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={cargar} disabled={loading} style={st.btnPri}>{loading ? "Cargando…" : "Actualizar"}</button>
      </div>

      {data && (
        <>
          {/* Resumen por tramo */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {tramos.map((t, i) => {
              const monto = (data.clientes ?? []).reduce((s, c) => s + (c[t] ?? 0), 0);
              return (
                <div key={t} style={{ background: "#fff", borderRadius: 10, padding: "14px 16px",
                                      boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${colors[i]}`,
                                      flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 11, color: "#888" }}>{labels[i]}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>{fmt(monto)}</div>
                </div>
              );
            })}
          </div>

          {/* Tabla por cliente */}
          <div style={st.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>{["Cliente", ...labels, "Total"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(data.clientes ?? []).map((c) => (
                    <tr key={c.clienteId} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontWeight: 500 }}>{c.nombre}</td>
                      {tramos.map((t, i) => (
                        <td key={t} style={{ ...st.td, textAlign: "right",
                                             color: (c[t] ?? 0) > 0 ? colors[i] : "#ccc",
                                             fontWeight: (c[t] ?? 0) > 0 ? 600 : 400 }}>
                          {(c[t] ?? 0) > 0 ? fmt(c[t]) : "—"}
                        </td>
                      ))}
                      <td style={{ ...st.td, textAlign: "right", fontWeight: 700 }}>{fmt(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ReportesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Reportes</span>
      </div>

      <div style={{ ...st.wrap, maxWidth: 1200 }}>
        <h2 style={st.h2}>Reportes Financieros</h2>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #eee" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
                       fontWeight: tab === i ? 700 : 400,
                       color: tab === i ? "#4E9AF1" : "#666",
                       borderBottom: tab === i ? "2px solid #4E9AF1" : "2px solid transparent",
                       marginBottom: -2, fontSize: 14 }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && <TabBalance />}
        {tab === 1 && <TabResultados />}
        {tab === 2 && <TabLibroDiario />}
        {tab === 3 && <TabCartera />}
      </div>
    </div>
  );
}

const st = {
  header: { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:   { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:  { fontWeight: 700, fontSize: 18 },
  breadcrumb: { color: "#555", fontSize: 14 },
  wrap:   { padding: "24px 28px", maxWidth: 1200, margin: "0 auto" },
  h2:     { margin: "0 0 20px", color: "#1a1a2e" },
  card:   { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:  { display: "block", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPri: { background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSec: { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  tabla:  { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th:     { background: "#f8f9fa", padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td:     { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
};
