import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";

const VACIO = { ruc: "", nombre: "", email: "", telefono: "", direccion: "" };

function Modal({ proveedor, onClose, onSuccess }) {
  const editando = !!proveedor?.id;
  const [form, setForm] = useState(editando ? {
    ruc: proveedor.ruc ?? "", nombre: proveedor.nombre ?? "",
    email: proveedor.email ?? "", telefono: proveedor.telefono ?? "", direccion: proveedor.direccion ?? "",
  } : { ...VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      if (editando) await api.put(`/proveedores/${proveedor.id}`, form);
      else          await api.post("/proveedores", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        <h3 style={{ margin: "0 0 18px" }}>{editando ? "Editar proveedor" : "Nuevo proveedor"}</h3>
        {[
          { k: "nombre",    label: "Nombre *",    placeholder: "Nombre o razón social" },
          { k: "ruc",       label: "RUC",          placeholder: "RUC del proveedor" },
          { k: "email",     label: "Email",         placeholder: "correo@proveedor.com" },
          { k: "telefono",  label: "Teléfono",      placeholder: "507-6000-0000" },
          { k: "direccion", label: "Dirección",     placeholder: "Dirección física" },
        ].map(({ k, label, placeholder }) => (
          <div key={k}>
            <label style={st.label}>{label}</label>
            <input style={st.input} value={form[k]} placeholder={placeholder}
                   onChange={(e) => c(k, e.target.value)} />
          </div>
        ))}
        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProveedoresPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modal, setModal]       = useState(null); // null | {} (nuevo) | proveedor (editar)
  const [confirm, setConfirm]   = useState(null); // proveedor a desactivar

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) p.set("buscar", buscar);
      const r = await api.get(`/proveedores?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar]);

  async function desactivar(id) {
    try { await api.delete(`/proveedores/${id}`); cargar(); } catch { /* noop */ }
    setConfirm(null);
  }

  const total    = data?.paginacion?.total ?? 0;
  const totalPag = data?.paginacion?.totalPaginas ?? 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Proveedores</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={st.h2}>Proveedores</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {data?.datos?.length > 0 && (
              <button onClick={() => exportarCSV(data.datos, ["ruc","nombre","email","telefono","direccion"], ["RUC","Nombre","Email","Teléfono","Dirección"], "proveedores")} style={st.btnSec}>↓ CSV</button>
            )}
            <button onClick={() => setModal({})} style={st.btnPri}>+ Nuevo proveedor</button>
          </div>
        </div>

        {/* KPI rápido */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ ...st.kpi, borderColor: "#4E9AF1" }}>
            <div style={{ fontSize: 11, color: "#888" }}>Total registrados</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>{total}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input style={{ ...st.input, flex: 1, maxWidth: 360, marginBottom: 0 }}
                 placeholder="Buscar por nombre, RUC, email…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>

        <div style={st.card}>
          {cargando ? <p style={st.empty}>Cargando…</p>
            : !data || data.datos.length === 0 ? <p style={st.empty}>No hay proveedores con ese filtro</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={st.tabla}>
                  <thead>
                    <tr>
                      {["Nombre / Razón Social", "RUC", "Email", "Teléfono", "Dirección", "Acciones"].map((h) => (
                        <th key={h} style={st.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.datos.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ ...st.td, fontWeight: 600 }}>{p.nombre}</td>
                        <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{p.ruc || "—"}</td>
                        <td style={{ ...st.td, fontSize: 13 }}>{p.email || "—"}</td>
                        <td style={{ ...st.td, fontSize: 13 }}>{p.telefono || "—"}</td>
                        <td style={{ ...st.td, fontSize: 12, color: "#666", maxWidth: 200,
                                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.direccion || "—"}
                        </td>
                        <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                          <button onClick={() => setModal(p)} style={st.btnAcc}>Editar</button>
                          <button onClick={() => setConfirm(p)}
                                  style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>Desactivar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {totalPag > 1 && (
          <div style={st.pag}>
            <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} proveedores</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal proveedor={modal?.id ? modal : null} onClose={() => setModal(null)} onSuccess={cargar} />
      )}

      {confirm && (
        <div style={st.overlay}>
          <div style={{ ...st.modal, maxWidth: 360 }}>
            <h3 style={{ margin: "0 0 10px" }}>¿Desactivar proveedor?</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              <strong>{confirm.nombre}</strong> quedará inactivo y no aparecerá en nuevas órdenes de compra.
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
  kpi:       { background: "#fff", borderRadius: 12, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: "4px solid", flex: "0 0 auto" },
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
