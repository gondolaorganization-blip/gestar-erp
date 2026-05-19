import { useState, useEffect, useCallback } from "react";
import { exportarCSV } from "../utils/exportarCSV";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const VACIO = { codigo: "", nombre: "", descripcion: "", tipo: "SERVICIO", precio: "", itbms: true };

const TIPO_COLOR = { BIEN: { color: "#4E9AF1", bg: "#eef5ff" }, SERVICIO: { color: "#9B59B6", bg: "#f5eeff" } };

function ModalProducto({ producto, onClose, onSuccess }) {
  const editando = !!producto?.id;
  const [form, setForm] = useState(editando ? {
    codigo: producto.codigo, nombre: producto.nombre,
    descripcion: producto.descripcion ?? "", tipo: producto.tipo,
    precio: String(producto.precio), itbms: producto.itbms,
    costo: String(producto.costo ?? ""), stockMinimo: String(producto.stockMinimo ?? "0"),
  } : { ...VACIO, costo: "", stockMinimo: "0" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.codigo.trim() || !form.nombre.trim() || form.precio === "") {
      setError("Código, nombre y precio son requeridos"); return;
    }
    const payload = {
      ...form,
      precio: parseFloat(form.precio),
      costo: form.costo ? parseFloat(form.costo) : undefined,
      stockMinimo: parseFloat(form.stockMinimo || 0),
    };
    setGuardando(true);
    try {
      if (editando) await api.put(`/productos/${producto.id}`, payload);
      else          await api.post("/productos", payload);
      onSuccess(); onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 18px" }}>{editando ? "Editar producto/servicio" : "Nuevo producto/servicio"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div>
            <label style={st.label}>Código *</label>
            <input style={st.input} value={form.codigo} placeholder="SRV-001"
                   onChange={(e) => c("codigo", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label style={st.label}>Tipo</label>
            <select style={st.input} value={form.tipo} onChange={(e) => c("tipo", e.target.value)}>
              <option value="SERVICIO">Servicio</option>
              <option value="BIEN">Bien / Mercancía</option>
            </select>
          </div>
        </div>

        <label style={st.label}>Nombre *</label>
        <input style={st.input} value={form.nombre} placeholder="Descripción corta del producto"
               onChange={(e) => c("nombre", e.target.value)} />

        <label style={st.label}>Descripción</label>
        <textarea style={{ ...st.input, resize: "vertical", minHeight: 60 }}
                  value={form.descripcion} placeholder="Descripción detallada (opcional)"
                  onChange={(e) => c("descripcion", e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 14px" }}>
          <div>
            <label style={st.label}>Precio venta (B/.) *</label>
            <input style={st.input} type="number" min="0" step="0.01" value={form.precio}
                   onChange={(e) => c("precio", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Costo (B/.)</label>
            <input style={st.input} type="number" min="0" step="0.01" value={form.costo}
                   placeholder="Opcional" onChange={(e) => c("costo", e.target.value)} />
          </div>
          {form.tipo === "BIEN" && (
            <div>
              <label style={st.label}>Stock mínimo</label>
              <input style={st.input} type="number" min="0" step="1" value={form.stockMinimo}
                     onChange={(e) => c("stockMinimo", e.target.value)} />
            </div>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={form.itbms} onChange={(e) => c("itbms", e.target.checked)} />
          <span style={{ fontSize: 14, color: "#333" }}>Aplica ITBMS (7% — tasa general Panamá)</span>
        </label>

        {form.precio && !isNaN(parseFloat(form.precio)) && form.itbms && (
          <div style={{ background: "#eef5ff", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#4E9AF1", marginBottom: 14 }}>
            Precio con ITBMS: <strong>{fmt(parseFloat(form.precio) * 1.07)}</strong>
          </div>
        )}

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductosPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modal, setModal]       = useState(null);
  const [confirm, setConfirm]   = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar)     p.set("buscar", buscar);
      if (filtroTipo) p.set("tipo", filtroTipo);
      const r = await api.get(`/productos?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroTipo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroTipo]);

  async function desactivar(id) {
    try { await api.delete(`/productos/${id}`); cargar(); } catch (e) {
      alert(e.response?.data?.error || "No se puede desactivar");
    }
    setConfirm(null);
  }

  const total    = data?.paginacion?.total ?? 0;
  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const bienes    = (data?.datos ?? []).filter((p) => p.tipo === "BIEN").length;
  const servicios = (data?.datos ?? []).filter((p) => p.tipo === "SERVICIO").length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Catálogo de Productos y Servicios</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={st.h2}>Productos y Servicios</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {data?.datos?.length > 0 && (
              <button onClick={() => exportarCSV(data.datos, ["codigo","nombre","tipo","precio","costo","stock","stockMinimo"], ["Código","Nombre","Tipo","Precio","Costo","Stock","Stock Mínimo"], "productos")} style={st.btnSec}>↓ CSV</button>
            )}
            <button onClick={() => setModal({})} style={st.btnPri}>+ Nuevo</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total en catálogo", value: total,    color: "#4E9AF1" },
            { label: "Bienes",            value: bienes,   color: "#00C896" },
            { label: "Servicios",         value: servicios, color: "#9B59B6" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 20px",
                                        boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${k.color}`,
                                        flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "#888" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
                 placeholder="Buscar por código, nombre…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select style={{ ...st.input, minWidth: 150, marginBottom: 0 }}
                  value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="BIEN">Bien</option>
            <option value="SERVICIO">Servicio</option>
          </select>
        </div>

        <div style={st.card}>
          {cargando ? <p style={st.empty}>Cargando…</p>
            : !data || data.datos.length === 0 ? <p style={st.empty}>No hay productos con ese filtro</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={st.tabla}>
                  <thead>
                    <tr>
                      {["Código", "Nombre", "Tipo", "Precio", "Con ITBMS", "ITBMS", "Acciones"].map((h) => (
                        <th key={h} style={st.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.datos.map((p) => {
                      const tc = TIPO_COLOR[p.tipo] ?? TIPO_COLOR.SERVICIO;
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1", fontWeight: 600 }}>{p.codigo}</td>
                          <td style={st.td}>
                            <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                            {p.descripcion && <div style={{ fontSize: 11, color: "#aaa" }}>{p.descripcion}</div>}
                          </td>
                          <td style={st.td}>
                            <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                           color: tc.color, background: tc.bg }}>{p.tipo}</span>
                          </td>
                          <td style={{ ...st.td, textAlign: "right", fontWeight: 700 }}>{fmt(p.precio)}</td>
                          <td style={{ ...st.td, textAlign: "right", color: p.itbms ? "#4E9AF1" : "#ccc" }}>
                            {p.itbms ? fmt(p.precioConItbms) : "—"}
                          </td>
                          <td style={st.td}>
                            {p.itbms
                              ? <span style={{ fontSize: 11, color: "#00C896", fontWeight: 600 }}>7% ✓</span>
                              : <span style={{ fontSize: 11, color: "#bbb" }}>Exento</span>}
                          </td>
                          <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                            <button onClick={() => setModal(p)} style={st.btnAcc}>Editar</button>
                            <button onClick={() => setConfirm(p)}
                                    style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>Desactivar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {totalPag > 1 && (
          <div style={st.pag}>
            <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} productos</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modal !== null && (
        <ModalProducto producto={modal?.id ? modal : null} onClose={() => setModal(null)} onSuccess={cargar} />
      )}

      {confirm && (
        <div style={st.overlay}>
          <div style={{ ...st.modal, maxWidth: 360 }}>
            <h3 style={{ margin: "0 0 10px" }}>¿Desactivar producto?</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              <strong>{confirm.nombre}</strong> no podrá usarse en nuevas facturas ni órdenes de compra.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)} style={st.btnSec}>Cancelar</button>
              <button onClick={() => desactivar(confirm.id)}
                      style={{ ...st.btnPri, background: "#FF6B6B" }}>Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  header:    { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:      { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:     { fontWeight: 700, fontSize: 18 },
  breadcrumb:{ color: "#555", fontSize: 14 },
  h2:        { margin: 0, color: "#1a1a2e" },
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
