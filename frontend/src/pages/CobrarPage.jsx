import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");

const ESTADO_CFG = {
  PENDIENTE: { color: "#F5A623", bg: "#fff8ee" },
  VENCIDA:   { color: "#FF6B6B", bg: "#fff0f0" },
};

function ModalPago({ factura, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ fecha: hoy, monto: Number(factura.total).toFixed(2), metodo: "TRANSFERENCIA", referencia: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { setError("Monto inválido"); return; }
    setGuardando(true);
    try {
      await api.post(`/facturas/${factura.id}/pagos`, form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al registrar pago");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 380 }}>
        <h3 style={{ margin: "0 0 4px" }}>Registrar cobro</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
          {factura.numero} — {factura.cliente?.nombre} — Total: <strong>{fmt(factura.total)}</strong>
        </p>
        <label style={st.label}>Fecha</label>
        <input style={st.input} type="date" value={form.fecha} onChange={(e) => c("fecha", e.target.value)} />
        <label style={st.label}>Monto cobrado</label>
        <input style={st.input} type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => c("monto", e.target.value)} />
        <label style={st.label}>Método</label>
        <select style={st.input} value={form.metodo} onChange={(e) => c("metodo", e.target.value)}>
          {["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA"].map((m) => <option key={m}>{m}</option>)}
        </select>
        <label style={st.label}>Referencia</label>
        <input style={st.input} value={form.referencia} onChange={(e) => c("referencia", e.target.value)} placeholder="# transferencia…" />
        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Registrar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CobrarPage() {
  const navigate = useNavigate();
  const [vencidas, setVencidas]     = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [modalPago, setModalPago]   = useState(null);
  const [pagina, setPagina]         = useState(1);
  const [data, setData]             = useState(null);
  const [buscar, setBuscar]         = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) p.set("buscar", buscar);
      const [vRes, pRes, allRes] = await Promise.all([
        api.get("/facturas?estado=VENCIDA&limite=100"),
        api.get("/facturas?estado=PENDIENTE&limite=100"),
        api.get(`/facturas?${p}&estado=PENDIENTE`),
      ]);
      setVencidas(vRes.data.datos ?? []);
      setPendientes(pRes.data.datos ?? []);
      setData(allRes.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar]);

  const totalVencido   = vencidas.reduce((s, f)   => s + Number(f.total), 0);
  const totalPendiente = pendientes.reduce((s, f) => s + Number(f.total), 0);
  const totalPag = data?.paginacion?.totalPaginas ?? 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Cuentas por Cobrar</span>
      </div>

      <div style={{ ...st.wrap, maxWidth: 1100 }}>
        <h2 style={st.h2}>Cuentas por Cobrar</h2>

        {/* Tarjetas resumen */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Por cobrar total",  value: fmt(totalPendiente + totalVencido), color: "#4E9AF1", sub: `${pendientes.length + vencidas.length} facturas` },
            { label: "Vencidas",          value: fmt(totalVencido),                 color: "#FF6B6B", sub: `${vencidas.length} facturas urgentes` },
            { label: "Pendientes",        value: fmt(totalPendiente),               color: "#F5A623", sub: `${pendientes.length} facturas` },
          ].map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px",
                                        boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${c.color}`,
                                        flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{c.value}</div>
              <div style={{ fontSize: 12, color: c.color, marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Alertas vencidas */}
        {vencidas.length > 0 && (
          <div style={{ background: "#fff0f0", border: "1px solid #FF6B6B33", borderRadius: 12,
                        padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: "#FF6B6B", fontSize: 14, marginBottom: 10 }}>
              ⚠ {vencidas.length} facturas vencidas — Acción inmediata requerida
            </div>
            {vencidas.slice(0, 3).map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                       background: "#fff", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{f.numero}</span>
                  <span style={{ color: "#666", fontSize: 13, marginLeft: 8 }}>{f.cliente?.nombre}</span>
                  <span style={{ color: "#FF6B6B", fontSize: 12, marginLeft: 8 }}>Vencida el {fmtFecha(f.fechaVence)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, color: "#FF6B6B" }}>{fmt(f.total)}</span>
                  <button onClick={() => setModalPago(f)} style={st.btnPri}>Cobrar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabla pendientes */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
                 placeholder="Buscar por número o cliente…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {data?.datos?.length > 0 && (
            <button onClick={() => exportarCSV(data.datos, ["numero","fecha","fechaVence","estado","total"], ["Número","Fecha","Vence","Estado","Total"], "cuentas_x_cobrar")} style={st.btnSec}>↓ CSV</button>
          )}
        </div>

        <div style={st.card}>
          {cargando ? <p style={st.empty}>Cargando…</p> : !data || data.datos.length === 0 ? (
            <p style={st.empty}>No hay facturas pendientes</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>{["N° Factura", "Cliente", "Fecha", "Vence", "Total", "Estado", ""].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.datos.map((f) => {
                    const cfg = ESTADO_CFG[f.estado] ?? ESTADO_CFG.PENDIENTE;
                    return (
                      <tr key={f.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{f.numero}</td>
                        <td style={st.td}>{f.cliente?.nombre}</td>
                        <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(f.fecha)}</td>
                        <td style={{ ...st.td, fontSize: 12, color: f.estado === "VENCIDA" ? "#FF6B6B" : "#333" }}>
                          {fmtFecha(f.fechaVence)}
                        </td>
                        <td style={{ ...st.td, textAlign: "right", fontWeight: 700 }}>{fmt(f.total)}</td>
                        <td style={st.td}>
                          <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                         color: cfg.color, background: cfg.bg }}>{f.estado}</span>
                        </td>
                        <td style={st.td}>
                          <button onClick={() => setModalPago(f)} style={{ ...st.btnAcc, color: "#00C896" }}>Cobrar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPag > 1 && (
          <div style={st.pag}>
            <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag}</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modalPago && <ModalPago factura={modalPago} onClose={() => setModalPago(null)} onSuccess={cargar} />}
    </div>
  );
}

const st = {
  header: { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:   { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:  { fontWeight: 700, fontSize: 18 },
  breadcrumb: { color: "#555", fontSize: 14 },
  wrap:   { padding: "24px 28px", maxWidth: 1100, margin: "0 auto" },
  h2:     { margin: "0 0 20px", color: "#1a1a2e" },
  card:   { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" },
  empty:  { padding: 40, textAlign: "center", color: "#888" },
  pag:    { display: "flex", gap: 8, justifyContent: "center", marginTop: 12 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal:  { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.18)" },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:  { display: "block", width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPri: { background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSec: { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  btnAcc: { background: "#f0f4ff", color: "#4E9AF1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  tabla:  { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th:     { background: "#f8f9fa", padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td:     { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
};
