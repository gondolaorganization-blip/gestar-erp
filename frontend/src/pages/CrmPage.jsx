import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";

// ── Constantes ────────────────────────────────────────────────────────────────

const ETAPAS = [
  { id: "PROSPECTO",    label: "Prospecto",    color: "#9B59B6", prob: 10  },
  { id: "CALIFICACION", label: "Calificación", color: "#3498DB", prob: 25  },
  { id: "PROPUESTA",    label: "Propuesta",    color: "#F39C12", prob: 50  },
  { id: "NEGOCIACION",  label: "Negociación",  color: "#E67E22", prob: 75  },
];

const ETAPAS_CERRADAS = [
  { id: "CERRADO_GANADO",   label: "Ganado",  color: "#00C896" },
  { id: "CERRADO_PERDIDO",  label: "Perdido", color: "#FF6B6B" },
];

const TODAS_ETAPAS = [...ETAPAS, ...ETAPAS_CERRADAS];

const ESTADOS_LEAD = ["NUEVO", "CONTACTADO", "CALIFICADO", "DESCARTADO"];
const ORIGENES     = ["MANUAL", "WEB", "REFERIDO", "LLAMADA", "REDES_SOCIALES"];
const TIPOS_ACT    = ["LLAMADA", "EMAIL", "REUNION", "NOTA", "TAREA"];

const TABS = ["Pipeline", "Entidades", "Contactos", "Leads", "Actividades"];

const INDUSTRIAS = ["TECNOLOGIA", "SALUD", "EDUCACION", "COMERCIO", "CONSTRUCCION",
                    "FINANZAS", "TURISMO", "MANUFACTURA", "SERVICIOS", "OTRO"];
const ESTADOS_ENTIDAD = ["PROSPECTO", "ACTIVO", "INACTIVO"];
const ESTADO_ENT_CFG = {
  PROSPECTO: { color: "#9B59B6", bg: "#f5eeff" },
  ACTIVO:    { color: "#00C896", bg: "#e6faf5" },
  INACTIVO:  { color: "#999",    bg: "#f5f5f5" },
};
const TIPOS_DOC = ["RUC", "CEDULA", "PASAPORTE"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");

const etapaCfg = (id) => TODAS_ETAPAS.find((e) => e.id === id) ?? { label: id, color: "#888" };

// ── Tarjeta de métrica ────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px",
                  boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${color}`, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Tarjeta de oportunidad (Kanban) ──────────────────────────────────────────

function KanbanCard({ op, onMover, onEliminar }) {
  const cfg = etapaCfg(op.etapa);
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px",
                  boxShadow: "0 1px 6px rgba(0,0,0,.09)", marginBottom: 10, cursor: "default" }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "#1a1a2e" }}>{op.titulo}</div>
      {(op.entidad || op.lead) && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
          {op.entidad
            ? op.entidad.nombre
            : `${op.lead.nombre} ${op.lead.apellido ?? ""}${op.lead.compania ? ` · ${op.lead.compania}` : ""}`}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>
          {op.valor !== null ? fmt(op.valor) : "—"}
        </span>
        <span style={{ fontSize: 11, color: "#aaa" }}>{op.probabilidad}%</span>
      </div>
      {op.fechaCierre && (
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Cierre: {fmtFecha(op.fechaCierre)}</div>
      )}
      {/* Botones para mover */}
      <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
        {ETAPAS.filter((e) => e.id !== op.etapa).map((e) => (
          <button key={e.id} onClick={() => onMover(op.id, e.id)}
            style={{ border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10,
                     cursor: "pointer", background: e.color + "22", color: e.color, fontWeight: 600 }}>
            → {e.label}
          </button>
        ))}
        <button onClick={() => onMover(op.id, "CERRADO_GANADO")}
          style={{ border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10,
                   cursor: "pointer", background: "#e6faf5", color: "#00C896", fontWeight: 600 }}>
          ✓ Ganar
        </button>
        <button onClick={() => onMover(op.id, "CERRADO_PERDIDO")}
          style={{ border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10,
                   cursor: "pointer", background: "#fff0f0", color: "#FF6B6B", fontWeight: 600 }}>
          ✗ Perder
        </button>
        <button onClick={() => onEliminar(op.id)}
          style={{ border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10,
                   cursor: "pointer", background: "#f5f5f5", color: "#999" }}>
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Modal Oportunidad ─────────────────────────────────────────────────────────

function ModalOportunidad({ entidades, leads, onClose, onSuccess }) {
  const [form, setForm] = useState({
    titulo: "", entidadId: "", leadId: "", valor: "", etapa: "PROSPECTO", fechaCierre: "", notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.titulo.trim()) { setError("El título es requerido"); return; }
    setGuardando(true);
    try {
      await api.post("/oportunidades", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        <h3 style={{ margin: "0 0 20px" }}>Nueva oportunidad</h3>

        <label style={st.label}>Título *</label>
        <input style={st.input} value={form.titulo} onChange={(e) => c("titulo", e.target.value)}
               placeholder="Propuesta de software ERP…" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Entidad asociada</label>
            <select style={st.input} value={form.entidadId} onChange={(e) => c("entidadId", e.target.value)}>
              <option value="">— Sin entidad —</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}{e.industria ? ` · ${e.industria}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={st.label}>Lead origen</label>
            <select style={st.input} value={form.leadId} onChange={(e) => c("leadId", e.target.value)}>
              <option value="">— Sin lead —</option>
              {(leads ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}{l.apellido ? ` ${l.apellido}` : ""}{l.compania ? ` · ${l.compania}` : ""}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Valor (B/.)</label>
            <input style={st.input} type="number" min="0" step="0.01" value={form.valor}
                   onChange={(e) => c("valor", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={st.label}>Etapa inicial</label>
            <select style={st.input} value={form.etapa} onChange={(e) => c("etapa", e.target.value)}>
              {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
        </div>

        <label style={st.label}>Fecha estimada de cierre</label>
        <input style={st.input} type="date" value={form.fechaCierre} onChange={(e) => c("fechaCierre", e.target.value)} />

        <label style={st.label}>Notas</label>
        <textarea style={{ ...st.input, height: 72, resize: "vertical" }} value={form.notas}
                  onChange={(e) => c("notas", e.target.value)} />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Crear oportunidad"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Convertir Lead → Cliente ────────────────────────────────────────────

function ModalConvertirCliente({ lead, onClose, onSuccess }) {
  const [form, setForm] = useState({
    tipoDoc: "RUC",
    numDoc: "",
    nombre: [lead.nombre, lead.apellido].filter(Boolean).join(" "),
    email: lead.email ?? "",
    telefono: lead.telefono ?? "",
    direccion: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);
  const [listo, setListo]         = useState(false);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.numDoc.trim()) { setError("El número de documento es requerido"); return; }
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      await api.post("/clientes", form);
      setListo(true);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear el cliente");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        {listo ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h3 style={{ margin: "0 0 8px", color: "#00C896" }}>¡Cliente creado!</h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
              <strong>{form.nombre}</strong> ya está disponible en el módulo de Clientes y Facturación.
            </p>
            <button onClick={onClose} style={st.btnPri}>Cerrar</button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 6px" }}>Convertir lead a cliente</h3>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
              {lead.nombre} {lead.apellido ?? ""}{lead.compania ? ` · ${lead.compania}` : ""}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Tipo doc.</label>
                <select style={st.input} value={form.tipoDoc} onChange={(e) => c("tipoDoc", e.target.value)}>
                  {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={st.label}>N° documento *</label>
                <input style={st.input} value={form.numDoc} onChange={(e) => c("numDoc", e.target.value)} placeholder="8-123-456" autoFocus />
              </div>
            </div>

            <label style={st.label}>Nombre / Razón social *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} />

            <label style={st.label}>Email</label>
            <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Teléfono</label>
                <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} />
              </div>
              <div>
                <label style={st.label}>Dirección</label>
                <input style={st.input} value={form.direccion} onChange={(e) => c("direccion", e.target.value)} placeholder="Ciudad de Panamá" />
              </div>
            </div>

            {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={st.btnSec}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={st.btnPri}>
                {guardando ? "Guardando…" : "Crear cliente →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal Lead ────────────────────────────────────────────────────────────────

const VACIO_LEAD = {
  nombre: "", apellido: "", email: "", telefono: "",
  compania: "", cargo: "", origen: "MANUAL", estado: "NUEVO", notas: "",
};

function ModalLead({ lead, onClose, onSuccess }) {
  const [form, setForm] = useState(lead ? { ...lead } : { ...VACIO_LEAD });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      if (lead) await api.put(`/leads/${lead.id}`, form);
      else       await api.post("/leads", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 20px" }}>{lead ? "Editar lead" : "Nuevo lead"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Nombre *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Juan" />
          </div>
          <div>
            <label style={st.label}>Apellido</label>
            <input style={st.input} value={form.apellido} onChange={(e) => c("apellido", e.target.value)} placeholder="Pérez" />
          </div>
          <div>
            <label style={st.label}>Email</label>
            <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} placeholder="juan@empresa.com" />
          </div>
          <div>
            <label style={st.label}>Teléfono</label>
            <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} placeholder="6000-0000" />
          </div>
          <div>
            <label style={st.label}>Empresa</label>
            <input style={st.input} value={form.compania} onChange={(e) => c("compania", e.target.value)} placeholder="Empresa S.A." />
          </div>
          <div>
            <label style={st.label}>Cargo</label>
            <input style={st.input} value={form.cargo} onChange={(e) => c("cargo", e.target.value)} placeholder="Gerente" />
          </div>
          <div>
            <label style={st.label}>Origen</label>
            <select style={st.input} value={form.origen} onChange={(e) => c("origen", e.target.value)}>
              {ORIGENES.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Estado</label>
            <select style={st.input} value={form.estado} onChange={(e) => c("estado", e.target.value)}>
              {ESTADOS_LEAD.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <label style={st.label}>Notas</label>
        <textarea style={{ ...st.input, height: 72, resize: "vertical" }} value={form.notas}
                  onChange={(e) => c("notas", e.target.value)} />

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

// ── Modal Actividad ───────────────────────────────────────────────────────────

function ModalActividad({ leads, oportunidades, leadId, oportunidadId, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tipo: "LLAMADA", titulo: "", descripcion: "", fecha: hoy,
    leadId: leadId ?? "", oportunidadId: oportunidadId ?? "", completada: false,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.titulo.trim()) { setError("El título es requerido"); return; }
    if (!form.leadId && !form.oportunidadId) { setError("Selecciona un lead o una oportunidad"); return; }
    setGuardando(true);
    try {
      await api.post("/actividades-crm", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        <h3 style={{ margin: "0 0 20px" }}>Nueva actividad</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Tipo</label>
            <select style={st.input} value={form.tipo} onChange={(e) => c("tipo", e.target.value)}>
              {TIPOS_ACT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Fecha</label>
            <input style={st.input} type="date" value={form.fecha} onChange={(e) => c("fecha", e.target.value)} />
          </div>
        </div>

        <label style={st.label}>Título *</label>
        <input style={st.input} value={form.titulo} onChange={(e) => c("titulo", e.target.value)}
               placeholder="Llamada de seguimiento…" />

        <label style={st.label}>Descripción</label>
        <textarea style={{ ...st.input, height: 64, resize: "vertical" }} value={form.descripcion}
                  onChange={(e) => c("descripcion", e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Lead</label>
            <select style={st.input} value={form.leadId} onChange={(e) => c("leadId", e.target.value)}>
              <option value="">— Ninguno —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre} {l.apellido ?? ""}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Oportunidad</label>
            <select style={st.input} value={form.oportunidadId} onChange={(e) => c("oportunidadId", e.target.value)}>
              <option value="">— Ninguna —</option>
              {oportunidades.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </div>
        </div>

        <label style={{ ...st.label, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.completada} onChange={(e) => c("completada", e.target.checked)} />
          Marcar como completada
        </label>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Entidad ─────────────────────────────────────────────────────────────

const VACIO_ENT = { nombre: "", ruc: "", industria: "", website: "", email: "", telefono: "", direccion: "", notas: "", estado: "PROSPECTO" };

function ModalEntidad({ entidad, onClose, onSuccess }) {
  const [form, setForm] = useState(entidad ? { ...entidad } : { ...VACIO_ENT });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      if (entidad) await api.put(`/entidades/${entidad.id}`, form);
      else         await api.post("/entidades", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 520 }}>
        <h3 style={{ margin: "0 0 20px" }}>{entidad ? "Editar entidad" : "Nueva entidad"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={st.label}>Nombre de la empresa *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Grupo Motta S.A." autoFocus />
          </div>
          <div>
            <label style={st.label}>RUC</label>
            <input style={st.input} value={form.ruc} onChange={(e) => c("ruc", e.target.value)} placeholder="8-123-456789" />
          </div>
          <div>
            <label style={st.label}>Industria</label>
            <select style={st.input} value={form.industria} onChange={(e) => c("industria", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {INDUSTRIAS.map((i) => <option key={i} value={i}>{i.charAt(0) + i.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label style={st.label}>Email</label>
            <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} placeholder="info@empresa.com" />
          </div>
          <div>
            <label style={st.label}>Teléfono</label>
            <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} placeholder="507-XXXX-XXXX" />
          </div>
          <div>
            <label style={st.label}>Sitio web</label>
            <input style={st.input} value={form.website} onChange={(e) => c("website", e.target.value)} placeholder="www.empresa.com" />
          </div>
          <div>
            <label style={st.label}>Estado</label>
            <select style={st.input} value={form.estado} onChange={(e) => c("estado", e.target.value)}>
              {ESTADOS_ENTIDAD.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={st.label}>Dirección</label>
            <input style={st.input} value={form.direccion} onChange={(e) => c("direccion", e.target.value)} placeholder="Ciudad de Panamá" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={st.label}>Notas</label>
            <textarea style={{ ...st.input, height: 64, resize: "vertical" }} value={form.notas} onChange={(e) => c("notas", e.target.value)} />
          </div>
        </div>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Contacto ────────────────────────────────────────────────────────────

const VACIO_CON = { entidadId: "", nombre: "", apellido: "", cargo: "", email: "", telefono: "", notas: "" };

function ModalContacto({ contacto, entidades, preEntidadId, onClose, onSuccess }) {
  const [form, setForm] = useState(contacto ? { ...contacto, entidadId: String(contacto.entidadId) } : { ...VACIO_CON, entidadId: preEntidadId ? String(preEntidadId) : "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.entidadId) { setError("La entidad es requerida"); return; }
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      if (contacto) await api.put(`/contactos/${contacto.id}`, form);
      else          await api.post("/contactos", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 480 }}>
        <h3 style={{ margin: "0 0 20px" }}>{contacto ? "Editar contacto" : "Nuevo contacto"}</h3>

        <label style={st.label}>Entidad (empresa) *</label>
        <select style={st.input} value={form.entidadId} onChange={(e) => c("entidadId", e.target.value)}>
          <option value="">— Seleccionar entidad —</option>
          {entidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Nombre *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Juan" autoFocus />
          </div>
          <div>
            <label style={st.label}>Apellido</label>
            <input style={st.input} value={form.apellido} onChange={(e) => c("apellido", e.target.value)} placeholder="Pérez" />
          </div>
          <div>
            <label style={st.label}>Cargo</label>
            <input style={st.input} value={form.cargo} onChange={(e) => c("cargo", e.target.value)} placeholder="CFO" />
          </div>
          <div>
            <label style={st.label}>Email</label>
            <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} placeholder="juan@empresa.com" />
          </div>
          <div>
            <label style={st.label}>Teléfono</label>
            <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} placeholder="6000-0000" />
          </div>
          <div>
            <label style={st.label}>Notas</label>
            <input style={st.input} value={form.notas} onChange={(e) => c("notas", e.target.value)} placeholder="Preferencia de contacto…" />
          </div>
        </div>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Convertir Entidad → Cliente ─────────────────────────────────────────

function ModalConvertirEntidad({ entidad, onClose, onSuccess }) {
  const [form, setForm] = useState({
    tipoDoc: "RUC", numDoc: entidad.ruc ?? "",
    nombre: entidad.nombre, email: entidad.email ?? "",
    telefono: entidad.telefono ?? "", direccion: entidad.direccion ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);
  const [listo, setListo]         = useState(false);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.numDoc.trim()) { setError("El número de documento es requerido"); return; }
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      await api.post(`/entidades/${entidad.id}/convertir`, form);
      setListo(true);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.error || "Error al convertir");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        {listo ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
            <h3 style={{ margin: "0 0 8px", color: "#00C896" }}>¡Cliente creado!</h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
              <strong>{form.nombre}</strong> ya está disponible en Facturación y Cuentas por Cobrar.
            </p>
            <button onClick={onClose} style={st.btnPri}>Cerrar</button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 6px" }}>Convertir entidad a cliente</h3>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
              Los datos se copiarán al módulo de Clientes. Puedes ajustarlos antes de confirmar.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Tipo doc.</label>
                <select style={st.input} value={form.tipoDoc} onChange={(e) => c("tipoDoc", e.target.value)}>
                  {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={st.label}>N° documento *</label>
                <input style={st.input} value={form.numDoc} onChange={(e) => c("numDoc", e.target.value)} placeholder="8-123-456" autoFocus />
              </div>
            </div>

            <label style={st.label}>Nombre / Razón social *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Email</label>
                <input style={st.input} type="email" value={form.email} onChange={(e) => c("email", e.target.value)} />
              </div>
              <div>
                <label style={st.label}>Teléfono</label>
                <input style={st.input} value={form.telefono} onChange={(e) => c("telefono", e.target.value)} />
              </div>
            </div>

            <label style={st.label}>Dirección</label>
            <input style={st.input} value={form.direccion} onChange={(e) => c("direccion", e.target.value)} placeholder="Ciudad de Panamá" />

            {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={st.btnSec}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...st.btnPri, background: "#00C896" }}>
                {guardando ? "Convirtiendo…" : "Confirmar → Cliente"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab Entidades ─────────────────────────────────────────────────────────────

function TabEntidades() {
  const [data, setData]             = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [buscar, setBuscar]         = useState("");
  const [filtroEstado, setFiltro]   = useState("");
  const [pagina, setPagina]         = useState(1);
  const [modal, setModal]           = useState(null);  // null | "nuevo" | entidad
  const [convertir, setConvertir]   = useState(null);  // entidad a convertir
  const [panel, setPanel]           = useState(null);  // entidad para el panel de detalle

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar)       p.set("buscar", buscar);
      if (filtroEstado) p.set("estado", filtroEstado);
      const r = await api.get(`/entidades?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado]);

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta entidad y todos sus contactos?")) return;
    try { await api.delete(`/entidades/${id}`); cargar(); } catch { /* noop */ }
  }

  const res      = data?.resumen ?? {};
  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      {/* Resumen por estado */}
      {Object.keys(res).length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {ESTADOS_ENTIDAD.map((e) => {
            const cfg = ESTADO_ENT_CFG[e] ?? {};
            return (
              <div key={e} onClick={() => setFiltro(filtroEstado === e ? "" : e)}
                style={{ background: cfg.bg, borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                         border: `1px solid ${filtroEstado === e ? cfg.color : "transparent"}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{e}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", marginLeft: 8 }}>{res[e] ?? 0}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 200, marginBottom: 0 }}
               placeholder="Buscar por nombre, RUC, industria…"
               value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <button onClick={() => setModal("nuevo")} style={st.btnPri}>+ Nueva entidad</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay entidades registradas. Crea la primera empresa prospecto.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["Empresa", "Industria", "Email", "Teléfono", "Contactos", "Oportunidades", "Estado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((e) => {
                  const cfg = ESTADO_ENT_CFG[e.estado] ?? {};
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontWeight: 600 }}>
                        <span onClick={() => setPanel(e)} style={{ cursor: "pointer", color: "#4E9AF1" }}>{e.nombre}</span>
                        {e.ruc && <div style={{ fontSize: 11, color: "#aaa" }}>RUC: {e.ruc}</div>}
                        {e.clienteId && <div style={{ fontSize: 11, color: "#00C896", fontWeight: 700 }}>✓ Cliente</div>}
                      </td>
                      <td style={{ ...st.td, fontSize: 12, color: "#666" }}>{e.industria ? e.industria.charAt(0) + e.industria.slice(1).toLowerCase() : "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{e.email ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{e.telefono ?? "—"}</td>
                      <td style={{ ...st.td, textAlign: "center" }}>{e.cantidadContactos}</td>
                      <td style={{ ...st.td, textAlign: "center" }}>{e.cantidadOportunidades}</td>
                      <td style={st.td}>
                        <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg }}>{e.estado}</span>
                      </td>
                      <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                        <button onClick={() => setPanel(e)} style={st.btnAcc}>Ver</button>
                        <button onClick={() => setModal(e)} style={{ ...st.btnAcc, marginLeft: 6 }}>Editar</button>
                        {!e.clienteId && (
                          <button onClick={() => setConvertir(e)} style={{ ...st.btnAcc, marginLeft: 6, color: "#00C896", background: "#e6faf5" }}>→ Cliente</button>
                        )}
                        <button onClick={() => eliminar(e.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>Eliminar</button>
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
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} entidades</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modal && <ModalEntidad entidad={modal === "nuevo" ? null : modal} onClose={() => setModal(null)} onSuccess={cargar} />}
      {convertir && <ModalConvertirEntidad entidad={convertir} onClose={() => setConvertir(null)} onSuccess={cargar} />}
      {panel && <PanelEntidad entidad={panel} onClose={() => setPanel(null)} onRefresh={cargar} />}
    </>
  );
}

// ── Panel de detalle de Entidad ───────────────────────────────────────────────

function PanelEntidad({ entidad, onClose, onRefresh }) {
  const [detalle, setDetalle]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [modalCon, setModalCon]   = useState(false);
  const [entidades, setEntidades] = useState([entidad]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get(`/entidades/${entidad.id}`);
      setDetalle(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [entidad.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function eliminarContacto(id) {
    if (!window.confirm("¿Eliminar este contacto?")) return;
    try { await api.delete(`/contactos/${id}`); cargar(); onRefresh(); } catch { /* noop */ }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0 }}>{entidad.nombre}</h3>
            {entidad.ruc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>RUC: {entidad.ruc}</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
        </div>

        {cargando ? <p style={{ textAlign: "center", color: "#888" }}>Cargando…</p> : detalle && (
          <>
            {/* Info básica */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20, fontSize: 12 }}>
              {[
                { l: "Industria", v: detalle.industria ? detalle.industria.charAt(0) + detalle.industria.slice(1).toLowerCase() : "—" },
                { l: "Email",     v: detalle.email     ?? "—" },
                { l: "Teléfono",  v: detalle.telefono  ?? "—" },
                { l: "Web",       v: detalle.website   ?? "—" },
                { l: "Dirección", v: detalle.direccion ?? "—" },
                { l: "Estado",    v: detalle.estado },
              ].map(({ l, v }) => (
                <div key={l} style={{ background: "#f8f9fa", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ color: "#888", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Contactos */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Contactos ({detalle.contactos?.length ?? 0})</h4>
              <button onClick={() => setModalCon(true)} style={{ ...st.btnPri, padding: "6px 14px", fontSize: 13 }}>+ Agregar contacto</button>
            </div>
            {detalle.contactos?.length === 0 ? (
              <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>Sin contactos. Agrega al gerente, director de compras, etc.</p>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {detalle.contactos.map((con) => (
                  <div key={con.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                             padding: "10px 14px", borderRadius: 8, background: "#f8f9fa", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{con.nombre} {con.apellido ?? ""}</span>
                      {con.cargo && <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>{con.cargo}</span>}
                      <div style={{ fontSize: 12, color: "#888" }}>{[con.email, con.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
                    </div>
                    <button onClick={() => eliminarContacto(con.id)} style={{ ...st.btnAcc, color: "#FF6B6B" }}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Oportunidades */}
            {detalle.oportunidades?.length > 0 && (
              <>
                <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Oportunidades ({detalle.oportunidades.length})</h4>
                {detalle.oportunidades.map((o) => {
                  const cfg = etapaCfg(o.etapa);
                  return (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px",
                                             borderRadius: 8, background: "#f8f9fa", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{o.titulo}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {o.valor != null && <span style={{ fontWeight: 700 }}>{fmt(o.valor)}</span>}
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + "22",
                                       padding: "2px 8px", borderRadius: 8 }}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {modalCon && (
          <ModalContacto
            contacto={null}
            entidades={entidades}
            preEntidadId={entidad.id}
            onClose={() => setModalCon(false)}
            onSuccess={() => { cargar(); onRefresh(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab Contactos ─────────────────────────────────────────────────────────────

function TabContactos() {
  const [data, setData]           = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [buscar, setBuscar]       = useState("");
  const [pagina, setPagina]       = useState(1);
  const [modal, setModal]         = useState(null);
  const [entidades, setEntidades] = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) p.set("buscar", buscar);
      const [cRes, eRes] = await Promise.all([
        api.get(`/contactos?${p}`),
        api.get("/entidades?limite=100"),
      ]);
      setData(cRes.data);
      setEntidades(eRes.data.datos ?? []);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar]);

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar este contacto?")) return;
    try { await api.delete(`/contactos/${id}`); cargar(); } catch { /* noop */ }
  }

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 200, marginBottom: 0 }}
               placeholder="Buscar por nombre, cargo, empresa…"
               value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <button onClick={() => setModal("nuevo")} style={st.btnPri}>+ Nuevo contacto</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay contactos. Créalos desde una entidad o aquí directamente.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["Nombre", "Cargo", "Entidad", "Email", "Teléfono", "Registrado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((con) => (
                  <tr key={con.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ ...st.td, fontWeight: 600 }}>{con.nombre} {con.apellido ?? ""}</td>
                    <td style={{ ...st.td, fontSize: 12, color: "#666" }}>{con.cargo ?? "—"}</td>
                    <td style={{ ...st.td, fontSize: 13 }}>
                      <span style={{ background: "#eef5ff", color: "#4E9AF1", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                        {con.entidad?.nombre ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...st.td, fontSize: 12 }}>{con.email ?? "—"}</td>
                    <td style={{ ...st.td, fontSize: 12 }}>{con.telefono ?? "—"}</td>
                    <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(con.creadoEn)}</td>
                    <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                      <button onClick={() => setModal(con)} style={st.btnAcc}>Editar</button>
                      <button onClick={() => eliminar(con.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPag > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} contactos</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modal && (
        <ModalContacto
          contacto={modal === "nuevo" ? null : modal}
          entidades={entidades}
          preEntidadId={null}
          onClose={() => setModal(null)}
          onSuccess={cargar}
        />
      )}
    </>
  );
}

// ── Pestaña Pipeline (Kanban) ─────────────────────────────────────────────────

function TabPipeline() {
  const [data, setData]             = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [entidades, setEntidades]   = useState([]);
  const [leads, setLeads]           = useState([]);
  const [modalOp, setModalOp]       = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [kRes, eRes, lRes] = await Promise.all([
        api.get("/oportunidades?vista=kanban"),
        api.get("/entidades?limite=100"),
        api.get("/leads?limite=100"),
      ]);
      setData(kRes.data);
      setEntidades(eRes.data.datos ?? []);
      setLeads(lRes.data.datos ?? []);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function mover(id, etapa) {
    try { await api.patch(`/oportunidades/${id}/etapa`, { etapa }); cargar(); } catch { /* noop */ }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta oportunidad?")) return;
    try { await api.delete(`/oportunidades/${id}`); cargar(); } catch { /* noop */ }
  }

  const m = data?.metricas;

  return (
    <>
      {m && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <MetCard label="Pipeline activo"   value={fmt(m.totalPipeline)}    sub={`${m.countActivo} oportunidades`}  color="#4E9AF1" />
          <MetCard label="Pipeline ponderado" value={fmt(m.pipelinePonderado)} sub="por probabilidad"                color="#9B59B6" />
          <MetCard label="Total ganado"      value={fmt(m.totalGanado)}      sub={`${m.countGanado} cerradas`}       color="#00C896" />
          <MetCard label="Total perdido"     value={fmt(m.totalPerdido)}     sub={`${m.countPerdido} perdidas`}      color="#FF6B6B" />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setModalOp(true)} style={st.btnPri}>+ Nueva oportunidad</button>
      </div>

      {cargando ? (
        <p style={{ textAlign: "center", color: "#888", padding: 40 }}>Cargando…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, overflowX: "auto" }}>
          {ETAPAS.map((etapa) => {
            const cols = data?.kanban?.[etapa.id] ?? [];
            const total = cols.reduce((s, o) => s + (o.valor ?? 0), 0);
            return (
              <div key={etapa.id}
                style={{ background: "#f8f9fa", borderRadius: 12, padding: "14px 12px", minWidth: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: etapa.color }}>{etapa.label}</span>
                    <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>{etapa.prob}%</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{fmt(total)}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>{cols.length} ops.</div>
                  </div>
                </div>
                {cols.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#ccc", fontSize: 12, padding: "20px 0" }}>Sin oportunidades</div>
                ) : (
                  cols.map((op) => (
                    <KanbanCard key={op.id} op={op} onMover={mover} onEliminar={eliminar} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOp && (
        <ModalOportunidad entidades={entidades} leads={leads} onClose={() => setModalOp(false)} onSuccess={cargar} />
      )}
    </>
  );
}

// ── Pestaña Leads ─────────────────────────────────────────────────────────────

const ESTADO_LEAD_COLOR = {
  NUEVO:       { color: "#4E9AF1", bg: "#eef5ff" },
  CONTACTADO:  { color: "#F5A623", bg: "#fff8ee" },
  CALIFICADO:  { color: "#00C896", bg: "#e6faf5" },
  DESCARTADO:  { color: "#999",    bg: "#f5f5f5" },
};

function TabLeads() {
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modal, setModal]             = useState(null);
  const [convertirLead, setConvertir] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (buscar)       p.set("buscar", buscar);
      if (filtroEstado) p.set("estado", filtroEstado);
      const r = await api.get(`/leads?${p}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado]);

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar este lead?")) return;
    try { await api.delete(`/leads/${id}`); cargar(); } catch { /* noop */ }
  }

  const res = data?.resumen ?? {};
  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      {/* Resumen por estado */}
      {Object.keys(res).length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {ESTADOS_LEAD.map((e) => {
            const cfg = ESTADO_LEAD_COLOR[e] ?? {};
            return (
              <div key={e} style={{ background: cfg.bg, borderRadius: 8, padding: "8px 14px",
                                    cursor: "pointer", border: `1px solid ${filtroEstado === e ? cfg.color : "transparent"}` }}
                   onClick={() => setFiltroEstado(filtroEstado === e ? "" : e)}>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{e}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", marginLeft: 8 }}>{res[e] ?? 0}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 200, marginBottom: 0 }}
               placeholder="Buscar por nombre, empresa, email…"
               value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        {data?.datos?.length > 0 && (
          <button onClick={() => exportarCSV(data.datos, ["nombre","apellido","email","telefono","compania","cargo","origen","estado"], ["Nombre","Apellido","Email","Teléfono","Empresa","Cargo","Origen","Estado"], "leads")} style={st.btnSec}>↓ CSV</button>
        )}
        <button onClick={() => setModal("nuevo")} style={st.btnPri}>+ Nuevo lead</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay leads registrados</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["Nombre", "Empresa", "Email", "Teléfono", "Origen", "Estado", "Opors.", "Actividades", "Registrado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((l) => {
                  const cfg = ESTADO_LEAD_COLOR[l.estado] ?? {};
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontWeight: 500 }}>{l.nombre} {l.apellido ?? ""}</td>
                      <td style={{ ...st.td, color: "#666" }}>{l.compania ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{l.email ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{l.telefono ?? "—"}</td>
                      <td style={{ ...st.td, fontSize: 12, color: "#888" }}>{l.origen.replace("_", " ")}</td>
                      <td style={st.td}>
                        <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 11,
                                       fontWeight: 700, color: cfg.color, background: cfg.bg }}>
                          {l.estado}
                        </span>
                      </td>
                      <td style={{ ...st.td, textAlign: "center" }}>{l.cantidadOportunidades}</td>
                      <td style={{ ...st.td, textAlign: "center" }}>{l.cantidadActividades}</td>
                      <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(l.creadoEn)}</td>
                      <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                        <button onClick={() => setModal(l)} style={st.btnAcc}>Editar</button>
                        <button onClick={() => setConvertir(l)} style={{ ...st.btnAcc, marginLeft: 6, color: "#00C896", background: "#e6faf5" }}>
                          → Cliente
                        </button>
                        <button onClick={() => eliminar(l.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>
                          Eliminar
                        </button>
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
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} leads</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modal && (
        <ModalLead
          lead={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={cargar}
        />
      )}

      {convertirLead && (
        <ModalConvertirCliente
          lead={convertirLead}
          onClose={() => setConvertir(null)}
          onSuccess={cargar}
        />
      )}
    </>
  );
}

// ── Pestaña Actividades ───────────────────────────────────────────────────────

const TIPO_ICON = { LLAMADA: "📞", EMAIL: "✉️", REUNION: "🤝", NOTA: "📝", TAREA: "✅" };

function TabActividades() {
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina]     = useState(1);
  const [soloPend, setSoloPend] = useState(false);
  const [modal, setModal]       = useState(false);
  const [leads, setLeads]       = useState([]);
  const [opps, setOpps]         = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 20 });
      if (soloPend) p.set("pendientes", "true");
      const [aRes, lRes, oRes] = await Promise.all([
        api.get(`/actividades-crm?${p}`),
        api.get("/leads?limite=100"),
        api.get("/oportunidades?limite=100"),
      ]);
      setData(aRes.data);
      setLeads(lRes.data.datos ?? []);
      setOpps(oRes.data.datos ?? []);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, soloPend]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [soloPend]);

  async function toggleCompletar(id) {
    try { await api.patch(`/actividades-crm/${id}/completar`); cargar(); } catch { /* noop */ }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta actividad?")) return;
    try { await api.delete(`/actividades-crm/${id}`); cargar(); } catch { /* noop */ }
  }

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={soloPend} onChange={(e) => setSoloPend(e.target.checked)} />
          Solo pendientes
        </label>
        <button onClick={() => setModal(true)} style={{ ...st.btnPri, marginLeft: "auto" }}>
          + Nueva actividad
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay actividades registradas</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["", "Tipo", "Título", "Fecha", "Lead", "Oportunidad", "Estado", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f5f5f5", opacity: a.completada ? 0.6 : 1 }}>
                    <td style={{ ...st.td, fontSize: 18 }}>{TIPO_ICON[a.tipo] ?? "•"}</td>
                    <td style={{ ...st.td, fontSize: 12, color: "#666" }}>{a.tipo}</td>
                    <td style={{ ...st.td, fontWeight: a.completada ? 400 : 500,
                                 textDecoration: a.completada ? "line-through" : "none" }}>
                      {a.titulo}
                    </td>
                    <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(a.fecha)}</td>
                    <td style={{ ...st.td, fontSize: 12 }}>
                      {a.lead ? `${a.lead.nombre} ${a.lead.apellido ?? ""}` : "—"}
                    </td>
                    <td style={{ ...st.td, fontSize: 12 }}>{a.oportunidad?.titulo ?? "—"}</td>
                    <td style={st.td}>
                      {a.completada
                        ? <span style={{ color: "#00C896", fontSize: 12, fontWeight: 600 }}>✓ Completada</span>
                        : <span style={{ color: "#F5A623", fontSize: 12, fontWeight: 600 }}>Pendiente</span>}
                    </td>
                    <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                      <button onClick={() => toggleCompletar(a.id)} style={st.btnAcc}>
                        {a.completada ? "Reabrir" : "Completar"}
                      </button>
                      <button onClick={() => eliminar(a.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPag > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} style={st.btnSec}>← Anterior</button>
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} actividades</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modal && (
        <ModalActividad
          leads={leads}
          oportunidades={opps}
          onClose={() => setModal(false)}
          onSuccess={cargar}
        />
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CrmPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "14px 24px",
                    display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18 }}>
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 18 }}>GESTAR ERP</span>
        <span style={{ color: "#555", fontSize: 14 }}>/ CRM · Pipeline Comercial</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 6px", color: "#1a1a2e" }}>CRM · Pipeline Comercial</h2>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
          Gestión de entidades, contactos, pipeline y actividades comerciales
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #eee", flexWrap: "wrap" }}>
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

        {tab === 0 && <TabPipeline />}
        {tab === 1 && <TabEntidades />}
        {tab === 2 && <TabContactos />}
        {tab === 3 && <TabLeads />}
        {tab === 4 && <TabActividades />}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 16, padding: 28, width: "100%",
    maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.18)",
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input: {
    display: "block", width: "100%", padding: "9px 12px", border: "1px solid #ddd",
    borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none",
  },
  btnPri: {
    background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8,
    padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14,
  },
  btnSec: {
    background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8,
    padding: "8px 16px", cursor: "pointer", fontSize: 13,
  },
  btnAcc: {
    background: "#f0f4ff", color: "#4E9AF1", border: "none", borderRadius: 6,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    background: "#f8f9fa", padding: "10px 14px", textAlign: "left",
    fontSize: 12, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap",
  },
  td: { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
};
