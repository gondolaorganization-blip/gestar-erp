import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";
import PanelAdjuntos from "../components/PanelAdjuntos";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");
const TASA_ITBMS = 0.07;

const ESTADO_CFG = {
  PENDIENTE: { color: "#F5A623", bg: "#fff8ee" },
  PAGADA:    { color: "#00C896", bg: "#e6faf5" },
  VENCIDA:   { color: "#FF6B6B", bg: "#fff0f0" },
  ANULADA:   { color: "#999",    bg: "#f5f5f5" },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG.PENDIENTE;
  return (
    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg }}>
      {estado}
    </span>
  );
}

// ── Modal: Nueva factura ──────────────────────────────────────────────────────

function ModalNuevaFactura({ clientes, productos, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ clienteId: "", fecha: hoy, fechaVence: "", notas: "" });
  const [lineas, setLineas] = useState([{ descripcion: "", cantidad: 1, precioUnit: "", itbms: false, productoId: "" }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cf = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cl = (i, k, v) => setLineas((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  function agregarLinea() {
    setLineas((ls) => [...ls, { descripcion: "", cantidad: 1, precioUnit: "", itbms: false, productoId: "" }]);
  }

  function eliminarLinea(i) {
    setLineas((ls) => ls.filter((_, idx) => idx !== i));
  }

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

  function calcTotales() {
    let subtotal = 0, itbms = 0;
    for (const l of lineas) {
      const cant = parseFloat(l.cantidad) || 0;
      const precio = parseFloat(l.precioUnit) || 0;
      const sub = cant * precio;
      subtotal += sub;
      if (l.itbms) itbms += sub * TASA_ITBMS;
    }
    return { subtotal, itbms, total: subtotal + itbms };
  }

  const tots = calcTotales();

  async function guardar() {
    setError(null);
    if (!form.clienteId) { setError("Selecciona un cliente"); return; }
    if (lineas.length === 0) { setError("Agrega al menos una línea"); return; }
    for (const l of lineas) {
      if (!l.descripcion.trim()) { setError("Todas las líneas deben tener descripción"); return; }
      if (!l.precioUnit || parseFloat(l.precioUnit) < 0) { setError("Precio inválido en alguna línea"); return; }
    }
    setGuardando(true);
    try {
      await api.post("/facturas", {
        clienteId: parseInt(form.clienteId),
        fecha: form.fecha,
        fechaVence: form.fechaVence || null,
        notas: form.notas || null,
        lineas: lineas.map((l) => ({
          productoId: l.productoId ? parseInt(l.productoId) : null,
          descripcion: l.descripcion.trim(),
          cantidad: parseFloat(l.cantidad),
          precioUnit: parseFloat(l.precioUnit),
          itbms: l.itbms,
        })),
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear factura");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 760 }}>
        <h3 style={{ margin: "0 0 20px" }}>Nueva factura</h3>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0 14px" }}>
          <div>
            <label style={st.label}>Cliente *</label>
            <select style={st.input} value={form.clienteId} onChange={(e) => cf("clienteId", e.target.value)}>
              <option value="">— Selecciona —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Fecha</label>
            <input style={st.input} type="date" value={form.fecha} onChange={(e) => cf("fecha", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Fecha de vencimiento</label>
            <input style={st.input} type="date" value={form.fechaVence} onChange={(e) => cf("fechaVence", e.target.value)} />
          </div>
        </div>

        {/* Líneas */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 80px 100px 60px 32px", gap: 6, marginBottom: 6 }}>
            {["Producto", "Descripción", "Cant.", "Precio unit.", "ITBMS", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>{h}</div>
            ))}
          </div>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 3fr 80px 100px 60px 32px", gap: 6, marginBottom: 6 }}>
              <select style={{ ...st.input, marginBottom: 0 }}
                      value={l.productoId} onChange={(e) => seleccionarProducto(i, e.target.value)}>
                <option value="">— Libre —</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input style={{ ...st.input, marginBottom: 0 }} value={l.descripcion}
                     onChange={(e) => cl(i, "descripcion", e.target.value)} placeholder="Descripción" />
              <input style={{ ...st.input, marginBottom: 0 }} type="number" min="0.01" step="0.01"
                     value={l.cantidad} onChange={(e) => cl(i, "cantidad", e.target.value)} />
              <input style={{ ...st.input, marginBottom: 0 }} type="number" min="0" step="0.01"
                     value={l.precioUnit} onChange={(e) => cl(i, "precioUnit", e.target.value)} placeholder="0.00" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <input type="checkbox" checked={l.itbms} onChange={(e) => cl(i, "itbms", e.target.checked)} />
              </div>
              <button onClick={() => eliminarLinea(i)} disabled={lineas.length === 1}
                      style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 16, padding: 0 }}>
                ×
              </button>
            </div>
          ))}
          <button onClick={agregarLinea} style={{ ...st.btnSec, fontSize: 12, marginTop: 4 }}>+ Agregar línea</button>
        </div>

        {/* Totales */}
        <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 24, justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>Subtotal</div>
            <div style={{ fontWeight: 600 }}>{fmt(tots.subtotal)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>ITBMS (7%)</div>
            <div style={{ fontWeight: 600, color: "#F5A623" }}>{fmt(tots.itbms)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#4E9AF1" }}>{fmt(tots.total)}</div>
          </div>
        </div>

        <label style={st.label}>Notas</label>
        <textarea style={{ ...st.input, height: 64, resize: "vertical" }} value={form.notas}
                  onChange={(e) => cf("notas", e.target.value)} />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Crear factura"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Registrar pago ─────────────────────────────────────────────────────

function ModalPago({ factura, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const pendiente = Number(factura.total) - (factura.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const [form, setForm] = useState({ fecha: hoy, monto: pendiente.toFixed(2), metodo: "TRANSFERENCIA", referencia: "", notas: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { setError("El monto debe ser mayor a 0"); return; }
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
      <div style={{ ...st.modal, maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 4px" }}>Registrar pago</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
          Factura {factura.numero} — Pendiente: <strong>{fmt(pendiente)}</strong>
        </p>
        <label style={st.label}>Fecha</label>
        <input style={st.input} type="date" value={form.fecha} onChange={(e) => c("fecha", e.target.value)} />
        <label style={st.label}>Monto</label>
        <input style={st.input} type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => c("monto", e.target.value)} />
        <label style={st.label}>Método de pago</label>
        <select style={st.input} value={form.metodo} onChange={(e) => c("metodo", e.target.value)}>
          {["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA"].map((m) => <option key={m}>{m}</option>)}
        </select>
        <label style={st.label}>Referencia (opcional)</label>
        <input style={st.input} value={form.referencia} onChange={(e) => c("referencia", e.target.value)} placeholder="# transferencia, cheque…" />
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

// ── Modal: Detalle de factura ─────────────────────────────────────────────────

function ModalDetalle({ facturaId, onClose, onPago, onAnular }) {
  const [data, setData]           = useState(null);
  const [enviando, setEnviando]   = useState(false);
  const [msgEmail, setMsgEmail]   = useState(null);
  const [descPDF, setDescPDF]     = useState(false);

  useEffect(() => {
    api.get(`/facturas/${facturaId}`).then((r) => setData(r.data)).catch(() => {});
  }, [facturaId]);

  async function descargarPDF() {
    setDescPDF(true);
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`/api/facturas/${facturaId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `factura-${data.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("No se pudo descargar el PDF"); }
    finally { setDescPDF(false); }
  }

  async function enviarCorreo() {
    setEnviando(true); setMsgEmail(null);
    try {
      const r = await api.post(`/facturas/${facturaId}/enviar`);
      setMsgEmail({ ok: true, texto: r.data.mensaje });
    } catch (e) {
      setMsgEmail({ ok: false, texto: e.response?.data?.error || "Error al enviar" });
    } finally { setEnviando(false); }
  }

  if (!data) return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 600, textAlign: "center", color: "#888" }}>Cargando…</div>
    </div>
  );

  const pagado = (data.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const pendiente = Number(data.total) - pagado;

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 2px" }}>Factura {data.numero}</h3>
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
              {data.cliente?.nombre} · {fmtFecha(data.fecha)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <EstadoBadge estado={data.estado} />
            <button onClick={onClose} style={{ ...st.btnSec, padding: "4px 12px" }}>✕</button>
          </div>
        </div>

        {/* Líneas */}
        <table style={{ ...st.tabla, marginBottom: 14 }}>
          <thead>
            <tr>{["Descripción", "Cant.", "Precio unit.", "ITBMS", "Subtotal"].map((h) => (
              <th key={h} style={st.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {(data.lineas ?? []).map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={st.td}>{l.descripcion}</td>
                <td style={{ ...st.td, textAlign: "right" }}>{Number(l.cantidad)}</td>
                <td style={{ ...st.td, textAlign: "right" }}>{fmt(l.precioUnit)}</td>
                <td style={{ ...st.td, textAlign: "center" }}>{l.itbms ? "7%" : "—"}</td>
                <td style={{ ...st.td, textAlign: "right", fontWeight: 600 }}>{fmt(l.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginBottom: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>Subtotal</div><div>{fmt(data.subtotal)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>ITBMS</div><div style={{ color: "#F5A623" }}>{fmt(data.itbms)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#888" }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#4E9AF1" }}>{fmt(data.total)}</div>
          </div>
        </div>

        {/* Pagos */}
        {(data.pagos ?? []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 }}>Pagos registrados</div>
            {data.pagos.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13,
                                       background: "#f8f9fa", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                <span>{fmtFecha(p.fecha)} · {p.metodo}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                <span style={{ fontWeight: 600, color: "#00C896" }}>{fmt(p.monto)}</span>
              </div>
            ))}
            <div style={{ textAlign: "right", fontSize: 13, color: "#888" }}>
              Pendiente: <strong style={{ color: pendiente > 0 ? "#FF6B6B" : "#00C896" }}>{fmt(pendiente)}</strong>
            </div>
          </div>
        )}

        <PanelAdjuntos tipo="FACTURA" referenciaId={facturaId} />

        {msgEmail && (
          <p style={{ fontSize: 13, marginBottom: 10, color: msgEmail.ok ? "#00C896" : "#FF6B6B" }}>
            {msgEmail.texto}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {data.estado !== "ANULADA" && data.estado !== "PAGADA" && (
            <>
              <button onClick={() => { onPago(data); onClose(); }} style={st.btnPri}>Registrar pago</button>
              <button onClick={() => { onAnular(data.id); onClose(); }}
                style={{ ...st.btnSec, color: "#FF6B6B" }}>Anular</button>
            </>
          )}
          <button onClick={descargarPDF} disabled={descPDF} style={st.btnSec}>
            {descPDF ? "Generando…" : "↓ PDF"}
          </button>
          <button onClick={enviarCorreo} disabled={enviando} style={st.btnSec}>
            {enviando ? "Enviando…" : "✉ Enviar por correo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FacturacionPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pagina, setPagina]     = useState(1);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalPago, setModalPago]   = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar)       p.set("buscar", buscar);
      if (filtroEstado) p.set("estado", filtroEstado);
      const [fRes, cRes, prRes] = await Promise.all([
        api.get(`/facturas?${p}`),
        api.get("/clientes?limite=200"),
        api.get("/productos?limite=200"),
      ]);
      setData(fRes.data);
      setClientes(cRes.data.datos ?? []);
      setProductos(prRes.data.datos ?? []);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado]);

  async function anular(id) {
    if (!window.confirm("¿Anular esta factura?")) return;
    try { await api.patch(`/facturas/${id}/anular`); cargar(); } catch { /* noop */ }
  }

  async function exportarExcel() {
    try {
      const token = localStorage.getItem("token") ?? "";
      const base  = import.meta.env.VITE_API_URL ?? "";
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      const res = await fetch(`${base}/api/facturas/exportar?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `facturas${filtroEstado ? `-${filtroEstado.toLowerCase()}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert("No se pudo exportar."); }
  }

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Facturación</span>
      </div>

      <div style={{ ...st.wrap, maxWidth: 1200 }}>
        <h2 style={st.h2}>Facturación</h2>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
                 placeholder="Buscar por número, cliente…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select style={{ ...st.input, minWidth: 140, marginBottom: 0 }}
                  value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {["PENDIENTE", "PAGADA", "VENCIDA", "ANULADA"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {data?.datos?.length > 0 && (
            <>
              <button onClick={() => exportarCSV(data.datos, ["numero","fecha","fechaVence","estado","subtotal","itbms","total"], ["Número","Fecha","Vence","Estado","Subtotal","ITBMS","Total"], "facturas")} style={st.btnSec}>↓ CSV</button>
              <button onClick={exportarExcel} style={{ ...st.btnSec, color: "#00C896" }}>↓ Excel</button>
            </>
          )}
          <button onClick={() => setModalNueva(true)} style={st.btnPri}>+ Nueva factura</button>
        </div>

        <div style={st.card}>
          {cargando ? (
            <p style={st.empty}>Cargando…</p>
          ) : !data || data.datos.length === 0 ? (
            <p style={st.empty}>No hay facturas{filtroEstado ? ` con estado ${filtroEstado}` : ""}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>{["N° Factura", "Cliente", "Fecha", "Vence", "Subtotal", "ITBMS", "Total", "Estado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.datos.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1", cursor: "pointer" }}
                          onClick={() => setModalDetalle(f.id)}>
                        {f.numero}
                      </td>
                      <td style={st.td}>{f.cliente?.nombre ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(f.fecha)}</td>
                      <td style={{ ...st.td, fontSize: 12, color: f.estado === "VENCIDA" ? "#FF6B6B" : "#666" }}>
                        {fmtFecha(f.fechaVence)}
                      </td>
                      <td style={{ ...st.td, textAlign: "right" }}>{fmt(f.subtotal)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#F5A623" }}>{fmt(f.itbms)}</td>
                      <td style={{ ...st.td, textAlign: "right", fontWeight: 700 }}>{fmt(f.total)}</td>
                      <td style={st.td}><EstadoBadge estado={f.estado} /></td>
                      <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                        <button onClick={() => setModalDetalle(f.id)} style={st.btnAcc}>Ver</button>
                        {(f.estado === "PENDIENTE" || f.estado === "VENCIDA") && (
                          <button onClick={() => setModalPago(f)} style={{ ...st.btnAcc, marginLeft: 6, color: "#00C896" }}>
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPag > 1 && (
          <div style={st.pag}>
            <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} facturas</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modalNueva && (
        <ModalNuevaFactura clientes={clientes} productos={productos}
          onClose={() => setModalNueva(false)} onSuccess={cargar} />
      )}
      {modalPago && (
        <ModalPago factura={modalPago} onClose={() => setModalPago(null)} onSuccess={cargar} />
      )}
      {modalDetalle && (
        <ModalDetalle facturaId={modalDetalle}
          onClose={() => setModalDetalle(null)}
          onPago={(f) => setModalPago(f)}
          onAnular={(id) => { anular(id); cargar(); }} />
      )}
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
