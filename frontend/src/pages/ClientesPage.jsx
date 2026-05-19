import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";

const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");
const TIPOS_DOC = ["RUC", "CEDULA", "PASAPORTE"];

const VACIO = {
  tipoDoc: "RUC", numDoc: "", nombre: "", email: "", telefono: "", direccion: "",
};

function ModalCliente({ cliente, onClose, onSuccess }) {
  const [form, setForm] = useState(cliente ? { ...cliente } : { ...VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.numDoc.trim() || !form.nombre.trim()) {
      setError("Número de documento y nombre son requeridos");
      return;
    }
    setGuardando(true);
    try {
      if (cliente) await api.put(`/clientes/${cliente.id}`, form);
      else          await api.post("/clientes", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 480 }}>
        <h3 style={{ margin: "0 0 20px" }}>{cliente ? "Editar cliente" : "Nuevo cliente"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
          <div>
            <label style={st.label}>Tipo doc.</label>
            <select style={st.input} value={form.tipoDoc} onChange={(e) => c("tipoDoc", e.target.value)}>
              {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Número de documento *</label>
            <input style={st.input} value={form.numDoc} onChange={(e) => c("numDoc", e.target.value)} placeholder="8-123-456789" />
          </div>
        </div>

        <label style={st.label}>Nombre / Razón social *</label>
        <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Cliente S.A." />

        <label style={st.label}>Email</label>
        <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} placeholder="contacto@cliente.com" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={st.label}>Teléfono</label>
            <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} placeholder="6000-0000" />
          </div>
          <div>
            <label style={st.label}>Dirección</label>
            <input style={st.input} value={form.direccion} onChange={(e) => c("direccion", e.target.value)} placeholder="Ciudad de Panamá" />
          </div>
        </div>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modal, setModal]       = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) p.set("buscar", buscar);
      const r = await api.get(`/clientes?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar]);

  async function desactivar(id) {
    if (!window.confirm("¿Desactivar este cliente?")) return;
    try { await api.delete(`/clientes/${id}`); cargar(); } catch { /* noop */ }
  }

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Clientes</span>
      </div>

      <div style={st.wrap}>
        <h2 style={st.h2}>Clientes</h2>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
                 placeholder="Buscar por nombre, RUC, email…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {data?.datos?.length > 0 && (
            <button onClick={() => exportarCSV(data.datos, ["tipoDoc","numDoc","nombre","email","telefono","direccion"], ["Tipo Doc","Número Doc","Nombre","Email","Teléfono","Dirección"], "clientes")} style={st.btnSec}>↓ CSV</button>
          )}
          <button onClick={() => setModal("nuevo")} style={st.btnPri}>+ Nuevo cliente</button>
        </div>

        <div style={st.card}>
          {cargando ? (
            <p style={st.empty}>Cargando…</p>
          ) : !data || data.datos.length === 0 ? (
            <p style={st.empty}>No hay clientes registrados</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>{["Tipo", "Documento", "Nombre / Razón social", "Email", "Teléfono", "Registrado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.datos.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontSize: 11, color: "#888" }}>{c.tipoDoc}</td>
                      <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{c.numDoc}</td>
                      <td style={{ ...st.td, fontWeight: 500 }}>{c.nombre}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{c.email ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{c.telefono ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(c.creadoEn)}</td>
                      <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                        <button onClick={() => setModal(c)} style={st.btnAcc}>Editar</button>
                        <button onClick={() => desactivar(c.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>Desactivar</button>
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
            <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} clientes</span>
            <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
          </div>
        )}
      </div>

      {modal && (
        <ModalCliente
          cliente={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={cargar}
        />
      )}
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
