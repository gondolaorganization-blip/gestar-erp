import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");
const R = (n) => Math.round(Number(n ?? 0) * 100) / 100;
const TASA_ITBMS = 0.07;

const ESTADO_CFG = {
  BORRADOR: { color: "#888",    bg: "#f5f5f5" },
  ENVIADA:  { color: "#F5A623", bg: "#fff8ee" },
  RECIBIDA: { color: "#4E9AF1", bg: "#eef5ff" },
  ANULADA:  { color: "#ccc",    bg: "#fafafa" },
};

const LINEA_VACIA = { productoId: "", descripcion: "", cantidad: "1", precioUnit: "", itbms: false };

// ── Modal: Nueva Orden de Compra ──────────────────────────────────────────────
function ModalNuevaOC({ proveedores, productos, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ proveedorId: "", fecha: hoy, fechaVence: "", notas: "" });
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cf = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cl = (i, k, v) => setLineas((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  function seleccionarProducto(i, prodId) {
    const prod = productos.find((p) => String(p.id) === String(prodId));
    if (prod) {
      setLineas((ls) => ls.map((l, idx) => idx === i
        ? { ...l, productoId: prodId, descripcion: prod.nombre, precioUnit: String(prod.precio), itbms: prod.itbms }
        : l));
    } else {
      cl(i, "productoId", "");
    }
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { ...LINEA_VACIA }]);
  }

  function quitarLinea(i) {
    setLineas((ls) => ls.filter((_, idx) => idx !== i));
  }

  function calcTotales() {
    let subtotal = 0, itbmsTotal = 0;
    for (const l of lineas) {
      const cant = parseFloat(l.cantidad) || 0;
      const pu   = parseFloat(l.precioUnit) || 0;
      const sub  = R(cant * pu);
      subtotal += sub;
      if (l.itbms) itbmsTotal += R(sub * TASA_ITBMS);
    }
    return { subtotal: R(subtotal), itbms: R(itbmsTotal), total: R(subtotal + itbmsTotal) };
  }

  async function guardar() {
    setError(null);
    if (!form.proveedorId) { setError("Selecciona un proveedor"); return; }
    if (lineas.length === 0) { setError("Agrega al menos una línea"); return; }
    for (const [i, l] of lineas.entries()) {
      if (!l.descripcion.trim() && !l.productoId) {
        setError(`Línea ${i + 1}: descripción o producto requerido`); return;
      }
      if (!parseFloat(l.cantidad) || parseFloat(l.cantidad) <= 0) {
        setError(`Línea ${i + 1}: cantidad inválida`); return;
      }
      if (!parseFloat(l.precioUnit) && parseFloat(l.precioUnit) !== 0) {
        setError(`Línea ${i + 1}: precio requerido`); return;
      }
    }
    setGuardando(true);
    try {
      const payload = {
        proveedorId: parseInt(form.proveedorId),
        fecha: form.fecha,
        fechaVence: form.fechaVence || null,
        notas: form.notas || null,
        lineas: lineas.map((l) => ({
          productoId: l.productoId ? parseInt(l.productoId) : null,
          descripcion: l.descripcion,
          cantidad: parseFloat(l.cantidad),
          precioUnit: parseFloat(l.precioUnit),
          itbms: l.itbms,
        })),
      };
      await api.post("/compras", payload);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear la orden");
    } finally { setGuardando(false); }
  }

  const { subtotal, itbms, total } = calcTotales();

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 720 }}>
        <h3 style={{ margin: "0 0 18px" }}>Nueva orden de compra</h3>

        {/* Cabecera */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0 14px" }}>
          <div>
            <label style={st.label}>Proveedor *</label>
            <select style={st.input} value={form.proveedorId} onChange={(e) => cf("proveedorId", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Fecha *</label>
            <input style={st.input} type="date" value={form.fecha} onChange={(e) => cf("fecha", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Fecha vencimiento</label>
            <input style={st.input} type="date" value={form.fechaVence} onChange={(e) => cf("fechaVence", e.target.value)} />
          </div>
        </div>

        {/* Líneas */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1.5fr 60px 36px",
                        gap: "0 8px", marginBottom: 4 }}>
            {["Producto", "Descripción", "Cantidad", "Precio unit.", "ITBMS", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#888", paddingBottom: 4 }}>{h}</div>
            ))}
          </div>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1.5fr 60px 36px",
                                   gap: "0 8px", marginBottom: 8, alignItems: "start" }}>
              <select style={{ ...st.input, marginBottom: 0 }}
                      value={l.productoId}
                      onChange={(e) => seleccionarProducto(i, e.target.value)}>
                <option value="">Manual</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input style={{ ...st.input, marginBottom: 0 }} value={l.descripcion}
                     placeholder="Descripción"
                     onChange={(e) => cl(i, "descripcion", e.target.value)} />
              <input style={{ ...st.input, marginBottom: 0 }} type="number" min="0.001" step="1"
                     value={l.cantidad} onChange={(e) => cl(i, "cantidad", e.target.value)} />
              <input style={{ ...st.input, marginBottom: 0 }} type="number" min="0" step="0.01"
                     value={l.precioUnit} placeholder="0.00"
                     onChange={(e) => cl(i, "precioUnit", e.target.value)} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={l.itbms} onChange={(e) => cl(i, "itbms", e.target.checked)} />
                  7%
                </label>
              </div>
              <button onClick={() => quitarLinea(i)} disabled={lineas.length === 1}
                      style={{ background: "#fff0f0", color: "#FF6B6B", border: "none", borderRadius: 6,
                               padding: "8px", cursor: lineas.length === 1 ? "not-allowed" : "pointer",
                               fontSize: 14, opacity: lineas.length === 1 ? 0.4 : 1 }}>✕</button>
            </div>
          ))}
          <button onClick={agregarLinea} style={{ ...st.btnSec, fontSize: 12, padding: "6px 14px" }}>
            + Agregar línea
          </button>
        </div>

        {/* Totales */}
        <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "12px 16px", marginBottom: 14,
                      display: "flex", gap: 24, justifyContent: "flex-end", fontSize: 13 }}>
          <span>Subtotal: <strong>{fmt(subtotal)}</strong></span>
          <span>ITBMS: <strong style={{ color: "#4E9AF1" }}>{fmt(itbms)}</strong></span>
          <span>Total: <strong style={{ fontSize: 16, color: "#1a1a2e" }}>{fmt(total)}</strong></span>
        </div>

        {/* Notas */}
        <label style={st.label}>Notas</label>
        <textarea style={{ ...st.input, resize: "vertical", minHeight: 56 }}
                  value={form.notas} placeholder="Referencia, términos, condiciones…"
                  onChange={(e) => cf("notas", e.target.value)} />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Creando…" : "Crear orden de compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Registrar pago ─────────────────────────────────────────────────────
function ModalPago({ orden, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ fecha: hoy, monto: Number(orden.total).toFixed(2), metodo: "TRANSFERENCIA", referencia: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { setError("Monto inválido"); return; }
    setGuardando(true);
    try {
      await api.post(`/compras/${orden.id}/pagos`, form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al registrar pago");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 380 }}>
        <h3 style={{ margin: "0 0 4px" }}>Registrar pago a proveedor</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
          {orden.numero} — {orden.proveedor?.nombre} — Total: <strong>{fmt(orden.total)}</strong>
        </p>
        <label style={st.label}>Fecha</label>
        <input style={st.input} type="date" value={form.fecha} onChange={(e) => c("fecha", e.target.value)} />
        <label style={st.label}>Monto</label>
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
            {guardando ? "Guardando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PagarPage() {
  const navigate = useNavigate();
  const [data, setData]           = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [buscar, setBuscar]       = useState("");
  const [filtroEstado, setFiltroEstado] = useState("RECIBIDA");
  const [pagina, setPagina]       = useState(1);
  const [modalPago, setModalPago] = useState(null);
  const [modalNuevaOC, setModalNuevaOC] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos]     = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar)       p.set("buscar", buscar);
      if (filtroEstado) p.set("estado", filtroEstado);
      const r = await api.get(`/compras?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado]);

  // Cargar catálogos para el modal de nueva OC
  useEffect(() => {
    Promise.all([
      api.get("/proveedores?limite=100"),
      api.get("/productos?limite=100"),
    ]).then(([pRes, prodRes]) => {
      setProveedores(pRes.data.datos ?? []);
      setProductos(prodRes.data.datos ?? []);
    }).catch(() => {});
  }, []);

  async function cambiarEstado(id, estado) {
    try { await api.patch(`/compras/${id}/estado`, { estado }); cargar(); } catch { /* noop */ }
  }

  async function descargarPDF(orden) {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`/api/compras/${orden.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = `oc-${orden.numero}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("No se pudo generar el PDF"); }
  }

  async function enviarCorreo(orden) {
    try {
      const r = await api.post(`/compras/${orden.id}/enviar`);
      alert(r.data.mensaje);
    } catch (e) {
      alert(e.response?.data?.error || "Error al enviar el correo");
    }
  }

  const totalPag   = data?.paginacion?.totalPaginas ?? 1;
  const total      = data?.paginacion?.total ?? 0;
  const totalMonto = (data?.datos ?? []).reduce((s, o) => s + Number(o.total), 0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Cuentas por Pagar</span>
      </div>

      <div style={{ ...st.wrap, maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ ...st.h2, margin: 0 }}>Cuentas por Pagar</h2>
          <button onClick={() => setModalNuevaOC(true)} style={st.btnPri}>
            + Nueva orden de compra
          </button>
        </div>

        {/* Resumen rápido */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Órdenes mostradas", value: total,            color: "#4E9AF1" },
            { label: "Monto total",        value: fmt(totalMonto), color: "#FF6B6B" },
          ].map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px",
                                        boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${c.color}`,
                                        flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 12, color: "#888" }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
                 placeholder="Buscar por número o proveedor…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select style={{ ...st.input, minWidth: 140, marginBottom: 0 }}
                  value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {["BORRADOR", "ENVIADA", "RECIBIDA", "ANULADA"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        <div style={st.card}>
          {cargando ? <p style={st.empty}>Cargando…</p> : !data || data.datos.length === 0 ? (
            <p style={st.empty}>No hay órdenes de compra con ese filtro</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>{["N° OC", "Proveedor", "Fecha", "Vence", "Total", "Estado", "Pagos", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.datos.map((o) => {
                    const cfg = ESTADO_CFG[o.estado] ?? ESTADO_CFG.BORRADOR;
                    const pagado = (o.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
                    return (
                      <tr key={o.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{o.numero}</td>
                        <td style={st.td}>{o.proveedor?.nombre}</td>
                        <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(o.fecha)}</td>
                        <td style={{ ...st.td, fontSize: 12, color: "#666" }}>{fmtFecha(o.fechaVence)}</td>
                        <td style={{ ...st.td, textAlign: "right", fontWeight: 700 }}>{fmt(o.total)}</td>
                        <td style={st.td}>
                          <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                         color: cfg.color, background: cfg.bg }}>{o.estado}</span>
                        </td>
                        <td style={{ ...st.td, textAlign: "right", fontSize: 12 }}>
                          {pagado > 0 ? <span style={{ color: "#00C896" }}>{fmt(pagado)}</span> : "—"}
                        </td>
                        <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                          {o.estado === "BORRADOR" && (
                            <button onClick={() => cambiarEstado(o.id, "ENVIADA")} style={st.btnAcc}>Enviar</button>
                          )}
                          {o.estado === "ENVIADA" && (
                            <button onClick={() => cambiarEstado(o.id, "RECIBIDA")}
                              style={{ ...st.btnAcc, color: "#00C896" }}>Recibir</button>
                          )}
                          {o.estado === "RECIBIDA" && (
                            <button onClick={() => setModalPago(o)}
                              style={{ ...st.btnAcc, color: "#FF6B6B" }}>Pagar</button>
                          )}
                          <button onClick={() => descargarPDF(o)}
                            style={{ ...st.btnAcc, marginLeft: 4 }}>↓ PDF</button>
                          <button onClick={() => enviarCorreo(o)}
                            style={{ ...st.btnAcc, marginLeft: 4, color: "#9B59B6" }}>✉</button>
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
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} órdenes</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modalNuevaOC && (
        <ModalNuevaOC
          proveedores={proveedores}
          productos={productos}
          onClose={() => setModalNuevaOC(false)}
          onSuccess={() => { cargar(); setFiltroEstado("BORRADOR"); }}
        />
      )}
      {modalPago && <ModalPago orden={modalPago} onClose={() => setModalPago(null)} onSuccess={cargar} />}
    </div>
  );
}

const st = {
  header:    { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:      { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:     { fontWeight: 700, fontSize: 18 },
  breadcrumb:{ color: "#555", fontSize: 14 },
  wrap:      { padding: "24px 28px", maxWidth: 1100, margin: "0 auto" },
  h2:        { margin: "0 0 20px", color: "#1a1a2e" },
  card:      { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" },
  empty:     { padding: 40, textAlign: "center", color: "#888" },
  pag:       { display: "flex", gap: 8, justifyContent: "center", marginTop: 12 },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal:     { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.18)" },
  label:     { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:     { display: "block", width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPri:    { background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSec:    { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  btnAcc:    { background: "#f0f4ff", color: "#4E9AF1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  tabla:     { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th:        { background: "#f8f9fa", padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td:        { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
};
