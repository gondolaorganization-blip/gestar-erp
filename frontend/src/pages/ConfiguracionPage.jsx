import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const TABS = ["Usuarios", "Roles", "Respaldo"];

function BadgeRol({ nombre }) {
  const color = nombre === "ADMIN" ? "#FF6B6B"
    : nombre === "CONTADOR" ? "#4E9AF1"
    : nombre === "VENDEDOR" ? "#00C896"
    : "#9B59B6";
  return (
    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                   color, background: `${color}18`, border: `1px solid ${color}33` }}>
      {nombre}
    </span>
  );
}

function ModalUsuario({ roles, onClose, onSuccess }) {
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rolId: roles[0]?.id ?? "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.nombre.trim() || !form.email.trim() || !form.password || !form.rolId) {
      setError("Todos los campos son requeridos"); return;
    }
    if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    setGuardando(true);
    try {
      await api.post("/usuarios", { ...form, rolId: parseInt(form.rolId) });
      onSuccess(); onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear usuario");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 18px" }}>Nuevo usuario</h3>
        <label style={st.label}>Nombre completo</label>
        <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Juan García" />
        <label style={st.label}>Email</label>
        <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} placeholder="usuario@empresa.com" />
        <label style={st.label}>Contraseña (mín. 8 caracteres)</label>
        <input style={st.input} type="password" value={form.password} onChange={(e) => c("password", e.target.value)} placeholder="••••••••" />
        <label style={st.label}>Rol</label>
        <select style={st.input} value={form.rolId} onChange={(e) => c("rolId", e.target.value)}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPassword({ usuario, onClose }) {
  const esAdmin = true; // En esta vista siempre es admin reseteando contraseña de otro
  const [pwd, setPwd] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  async function guardar() {
    setError(null);
    if (pwd.length < 8) { setError("Mínimo 8 caracteres"); return; }
    setGuardando(true);
    try {
      await api.patch(`/usuarios/${usuario.id}/password`, { passwordNuevoAdmin: pwd });
      setOk(true);
    } catch (e) {
      setError(e.response?.data?.error || "Error al cambiar contraseña");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 380 }}>
        <h3 style={{ margin: "0 0 6px" }}>Resetear contraseña</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 18 }}>{usuario.nombre} · {usuario.email}</p>
        {ok ? (
          <>
            <p style={{ color: "#00C896", fontWeight: 600 }}>Contraseña actualizada correctamente.</p>
            <div style={{ textAlign: "right", marginTop: 12 }}>
              <button onClick={onClose} style={st.btnPri}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <label style={st.label}>Nueva contraseña</label>
            <input style={st.input} type="password" value={pwd}
                   onChange={(e) => setPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
            {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={st.btnSec}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={st.btnPri}>
                {guardando ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab Usuarios ──────────────────────────────────────────────────────────────
function TabUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalPwd, setModalPwd]     = useState(null);
  const yo = JSON.parse(localStorage.getItem("usuario") || "{}");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [uRes, rRes] = await Promise.all([
        api.get("/usuarios"),
        api.get("/usuarios/roles"),
      ]);
      setUsuarios(uRes.data);
      setRoles(rRes.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggle(u) {
    try { await api.patch(`/usuarios/${u.id}/toggle`); cargar(); } catch { /* noop */ }
  }

  if (cargando) return <p style={st.empty}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModalNuevo(true)} style={st.btnPri}>+ Nuevo usuario</button>
      </div>

      <div style={st.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={st.tabla}>
            <thead>
              <tr>
                {["Nombre", "Email", "Rol", "Último acceso", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={st.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f5f5f5", opacity: u.activo ? 1 : 0.5 }}>
                  <td style={{ ...st.td, fontWeight: 600 }}>
                    {u.nombre}
                    {u.email === yo.email && (
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>(tú)</span>
                    )}
                  </td>
                  <td style={{ ...st.td, fontSize: 13 }}>{u.email}</td>
                  <td style={st.td}><BadgeRol nombre={u.rol?.nombre ?? "—"} /></td>
                  <td style={{ ...st.td, fontSize: 12, color: "#888" }}>
                    {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleDateString("es-PA") : "Nunca"}
                  </td>
                  <td style={st.td}>
                    <span style={{ fontSize: 12, fontWeight: 600,
                                   color: u.activo ? "#00C896" : "#ccc" }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                    <button onClick={() => setModalPwd(u)} style={st.btnAcc}>Reset pwd</button>
                    {u.email !== yo.email && (
                      <button onClick={() => toggle(u)}
                              style={{ ...st.btnAcc, marginLeft: 6,
                                       color: u.activo ? "#FF6B6B" : "#00C896" }}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalNuevo && <ModalUsuario roles={roles} onClose={() => setModalNuevo(false)} onSuccess={cargar} />}
      {modalPwd   && <ModalPassword usuario={modalPwd} onClose={() => setModalPwd(null)} />}
    </div>
  );
}

// ── Tab Respaldo ──────────────────────────────────────────────────────────────
function TabRespaldo() {
  const [descargando, setDescargando] = useState(false);
  const [error, setError]             = useState(null);
  const [ok, setOk]                   = useState(false);

  async function descargar() {
    setError(null); setOk(false); setDescargando(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al generar el backup');
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      const fecha    = new Date().toISOString().split('T')[0];
      a.href         = url;
      a.download     = `backup-gestar-${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setOk(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(false);
    }
  }

  const HOJAS = [
    { nombre: 'Clientes',        desc: 'Nombre, documento, contacto' },
    { nombre: 'Proveedores',     desc: 'Nombre, RUC, contacto' },
    { nombre: 'Productos',       desc: 'Código, precio, stock, ITBMS' },
    { nombre: 'Facturas',        desc: 'Número, fecha, cliente, totales, estado' },
    { nombre: 'Líneas Factura',  desc: 'Detalle de cada línea por factura' },
    { nombre: 'Cobros',          desc: 'Pagos recibidos de clientes' },
    { nombre: 'Órdenes Compra',  desc: 'Número, fecha, proveedor, totales' },
    { nombre: 'Líneas Compra',   desc: 'Detalle de cada línea por orden' },
    { nombre: 'Pagos Proveedor', desc: 'Pagos realizados a proveedores' },
    { nombre: 'Empleados',       desc: 'Cédula, cargo, salario, fecha ingreso' },
    { nombre: 'Períodos Nómina', desc: 'Períodos con totales bruto, neto y patrono' },
    { nombre: 'Líneas Nómina',   desc: 'CSS, SEA, ISR y neto por empleado' },
    { nombre: 'Usuarios',        desc: 'Email, rol y último acceso' },
  ];

  return (
    <div>
      <div style={st.card}>
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 6px', color: '#1a1a2e' }}>Backup completo en Excel</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Descarga toda la información de tu empresa en un archivo Excel con una hoja por módulo.
            Los datos en la base de datos <strong>nunca se borran</strong> — este archivo es una copia
            adicional para resguardo externo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 24 }}>
            {HOJAS.map((h) => (
              <div key={h.nombre} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px',
                                           borderLeft: '3px solid #4E9AF1' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{h.nombre}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{h.desc}</div>
              </div>
            ))}
          </div>

          {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {ok    && <p style={{ color: '#00C896', fontSize: 13, marginBottom: 12 }}>Backup descargado correctamente.</p>}

          <button onClick={descargar} disabled={descargando} style={{
            ...st.btnPri, fontSize: 15, padding: '11px 28px',
            opacity: descargando ? 0.7 : 1,
          }}>
            {descargando ? 'Generando…' : '⬇ Descargar backup (.xlsx)'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '12px 16px', background: '#fffbe6', borderRadius: 10,
                    border: '1px solid #ffe68a', fontSize: 12, color: '#7a6000' }}>
        <strong>Recomendación:</strong> Guarda el archivo en un servicio de nube externo (Google Drive,
        Dropbox, etc.) y genera un backup al menos una vez por mes.
      </div>
    </div>
  );
}

// ── Tab Roles ─────────────────────────────────────────────────────────────────
function TabRoles() {
  const [roles, setRoles]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/usuarios/roles");
        setRoles(r.data);
      } catch { /* noop */ }
      finally { setCargando(false); }
    })();
  }, []);

  if (cargando) return <p style={st.empty}>Cargando…</p>;

  const PERMISOS_ORDEN = ["leer", "crear", "editar", "eliminar"];
  const MODULOS_ORDEN  = ["dashboard", "clientes", "productos", "facturas", "contabilidad", "reportes", "usuarios"];

  return (
    <div>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
        Los roles definen qué puede hacer cada usuario. El rol <strong>ADMIN</strong> tiene acceso completo y no puede modificarse.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {roles.map((r) => (
          <div key={r.id} style={st.card}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0",
                          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <BadgeRol nombre={r.nombre} />
              <span style={{ fontSize: 12, color: "#aaa" }}>{r.totalUsuarios ?? 0} usuario(s)</span>
            </div>
            <div style={{ padding: "12px 18px" }}>
              {r.permisos?.todo
                ? <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Acceso total a todos los módulos</p>
                : (
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", color: "#aaa", paddingBottom: 6, fontWeight: 600 }}>Módulo</th>
                        {PERMISOS_ORDEN.map((p) => (
                          <th key={p} style={{ textAlign: "center", color: "#aaa", paddingBottom: 6, fontWeight: 600 }}>
                            {p.charAt(0).toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULOS_ORDEN.map((m) => {
                        const perms = r.permisos?.[m] ?? {};
                        return (
                          <tr key={m}>
                            <td style={{ padding: "3px 0", color: "#666", textTransform: "capitalize" }}>{m}</td>
                            {PERMISOS_ORDEN.map((p) => (
                              <td key={p} style={{ textAlign: "center" }}>
                                {perms[p]
                                  ? <span style={{ color: "#00C896", fontSize: 12 }}>✓</span>
                                  : <span style={{ color: "#eee", fontSize: 12 }}>—</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Configuración</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={st.h2}>Configuración del sistema</h2>
          <div style={{ fontSize: 13, color: "#888" }}>
            Empresa: <strong style={{ color: "#1a1a2e" }}>{usuario.empresa ?? "—"}</strong>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#fff",
                      borderRadius: 10, padding: 4, boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                      width: "fit-content" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              background: tab === i ? "#4E9AF1" : "transparent",
              color: tab === i ? "#fff" : "#888",
              border: "none", borderRadius: 8, padding: "7px 18px",
              cursor: "pointer", fontWeight: 600, fontSize: 13,
            }}>{t}</button>
          ))}
        </div>

        {tab === 0 ? <TabUsuarios /> : tab === 1 ? <TabRoles /> : <TabRespaldo />}
      </div>
    </div>
  );
}

const st = {
  header:    { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:      { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:     { fontWeight: 700, fontSize: 18 },
  breadcrumb:{ color: "#555", fontSize: 14 },
  h2:        { margin: 0, color: "#1a1a2e" },
  card:      { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden", marginBottom: 4 },
  empty:     { padding: 40, textAlign: "center", color: "#888" },
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
