import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { exportarCSV } from "../utils/exportarCSV";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `B/. ${Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString("es-PA") : "—";

const ESTADO_COLOR = {
  BORRADOR: { color: "#F5A623", bg: "#fff8ee" },
  APROBADO: { color: "#4E9AF1", bg: "#eef5ff" },
  PAGADO:   { color: "#00C896", bg: "#e6faf5" },
};

const TABS = ["Empleados", "Nóminas", "Décimo 13°"];

// ── Componentes menores ───────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLOR[estado] ?? ESTADO_COLOR.BORRADOR;
  return (
    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                   color: cfg.color, background: cfg.bg }}>
      {estado}
    </span>
  );
}

function Tarjeta({ label, value, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${color}`,
                  minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
    </div>
  );
}

// ── Modal Empleado ────────────────────────────────────────────────────────────

const VACIO_EMP = {
  cedula: "", nombre: "", apellido: "", email: "", telefono: "",
  cargo: "", departamento: "", fechaIngreso: "", tipoContrato: "INDEFINIDO",
  salarioMensual: "", periodoPago: "QUINCENAL",
};

function ModalEmpleado({ empleado, onClose, onSuccess }) {
  const [form, setForm] = useState(empleado ? {
    ...empleado,
    fechaIngreso: empleado.fechaIngreso?.slice(0, 10) ?? "",
    salarioMensual: String(empleado.salarioMensual),
  } : { ...VACIO_EMP });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    const sal = parseFloat(form.salarioMensual);
    if (!form.cedula || !form.nombre || !form.apellido || !form.cargo || !form.fechaIngreso || isNaN(sal) || sal <= 0) {
      setError("Cédula, nombre, apellido, cargo, fecha de ingreso y salario son requeridos");
      return;
    }
    setGuardando(true);
    try {
      if (empleado) {
        await api.put(`/empleados/${empleado.id}`, form);
      } else {
        await api.post("/empleados", form);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 540 }}>
        <h3 style={{ margin: "0 0 20px" }}>{empleado ? "Editar empleado" : "Nuevo empleado"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Cédula *</label>
            <input style={st.input} value={form.cedula} onChange={(e) => c("cedula", e.target.value)} placeholder="8-123-4567" />
          </div>
          <div>
            <label style={st.label}>Cargo *</label>
            <input style={st.input} value={form.cargo} onChange={(e) => c("cargo", e.target.value)} placeholder="Contador" />
          </div>
          <div>
            <label style={st.label}>Nombre *</label>
            <input style={st.input} value={form.nombre} onChange={(e) => c("nombre", e.target.value)} placeholder="Juan" />
          </div>
          <div>
            <label style={st.label}>Apellido *</label>
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
            <label style={st.label}>Departamento</label>
            <input style={st.input} value={form.departamento} onChange={(e) => c("departamento", e.target.value)} placeholder="Administración" />
          </div>
          <div>
            <label style={st.label}>Fecha de ingreso *</label>
            <input style={st.input} type="date" value={form.fechaIngreso} onChange={(e) => c("fechaIngreso", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Tipo contrato</label>
            <select style={st.input} value={form.tipoContrato} onChange={(e) => c("tipoContrato", e.target.value)}>
              <option value="INDEFINIDO">Indefinido</option>
              <option value="DEFINIDO">Definido</option>
              <option value="TEMPORAL">Temporal</option>
            </select>
          </div>
          <div>
            <label style={st.label}>Período de pago</label>
            <select style={st.input} value={form.periodoPago} onChange={(e) => c("periodoPago", e.target.value)}>
              <option value="QUINCENAL">Quincenal</option>
              <option value="MENSUAL">Mensual</option>
            </select>
          </div>
        </div>

        <label style={st.label}>Salario mensual (B/.) *</label>
        <input style={st.input} type="number" min="0" step="0.01"
               value={form.salarioMensual} onChange={(e) => c("salarioMensual", e.target.value)} placeholder="0.00" />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "4px 0" }}>{error}</p>}

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

// ── Modal crear período de nómina ─────────────────────────────────────────────

function ModalPeriodo({ tipo, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tipo: tipo || "REGULAR",
    fechaInicio: hoy,
    fechaFin:    hoy,
    fechaPago:   hoy,
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await api.post("/nomina", form);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear nómina");
    } finally {
      setGuardando(false);
    }
  }

  const esDec = form.tipo === "DECIMO";

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 460 }}>
        <h3 style={{ margin: "0 0 4px" }}>Generar nómina</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
          Se calculará automáticamente para todos los empleados activos.
        </p>

        <label style={st.label}>Tipo</label>
        <select style={st.input} value={form.tipo} onChange={(e) => c("tipo", e.target.value)}>
          <option value="REGULAR">Regular (CSS + SEA + ISR)</option>
          <option value="DECIMO">Décimo tercer mes</option>
        </select>

        {esDec && (
          <div style={{ background: "#fff8ee", border: "1px solid #F5A623", borderRadius: 8,
                        padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#7a5000" }}>
            El décimo tercer mes equivale a 1/3 del salario mensual. Se paga en abril, agosto y diciembre.
            No aplica CSS ni ISR sobre este rubro.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Fecha inicio período</label>
            <input style={st.input} type="date" value={form.fechaInicio} onChange={(e) => c("fechaInicio", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Fecha fin período</label>
            <input style={st.input} type="date" value={form.fechaFin} onChange={(e) => c("fechaFin", e.target.value)} />
          </div>
        </div>

        <label style={st.label}>Fecha de pago</label>
        <input style={st.input} type="date" value={form.fechaPago} onChange={(e) => c("fechaPago", e.target.value)} />

        <label style={st.label}>Notas (opcional)</label>
        <textarea style={{ ...st.input, height: 64, resize: "vertical" }}
                  value={form.notas} onChange={(e) => c("notas", e.target.value)} />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Calculando…" : "Generar nómina"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal detalle período ─────────────────────────────────────────────────────

function ModalDetallePeriodo({ periodo, onClose, onEstadoChange }) {
  const [data, setData]             = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [cambiando, setCambiando]   = useState(false);
  const [editLinea, setEditLinea]   = useState(null);
  const [enviando, setEnviando]     = useState(false);
  const [msgComprobante, setMsgComprobante] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get(`/nomina/${periodo.id}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [periodo.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarEstado(nuevoEstado) {
    setCambiando(true);
    try {
      await api.patch(`/nomina/${periodo.id}/estado`, { estado: nuevoEstado });
      onEstadoChange();
      cargar();
    } catch { /* noop */ }
    finally { setCambiando(false); }
  }

  async function enviarComprobantes() {
    setEnviando(true);
    setMsgComprobante(null);
    try {
      const r = await api.post(`/nomina/${periodo.id}/comprobantes`);
      setMsgComprobante(r.data.mensaje);
    } catch (e) {
      setMsgComprobante(e.response?.data?.error || "Error al enviar comprobantes");
    } finally { setEnviando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 820, width: "96vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>
              {data?.numero ?? periodo.numero} — {data?.tipo ?? periodo.tipo}
            </h3>
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
              {fmtFecha(data?.fechaInicio)} al {fmtFecha(data?.fechaFin)} · Pago: {fmtFecha(data?.fechaPago)}
            </p>
          </div>
          <button onClick={onClose} style={{ ...st.btnSec, padding: "4px 12px" }}>✕ Cerrar</button>
        </div>

        {cargando ? (
          <p style={{ color: "#888" }}>Cargando…</p>
        ) : !data ? (
          <p style={{ color: "#FF6B6B" }}>Error al cargar</p>
        ) : (
          <>
            {/* Resumen */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <Tarjeta label="Total bruto"      value={fmt(data.totalBruto)}     color="#4E9AF1" />
              <Tarjeta label="Deducciones"       value={fmt(data.totalDeduccion)} color="#FF6B6B" />
              <Tarjeta label="Costo patrono"     value={fmt(data.totalPatrono)}   color="#F5A623" />
              <Tarjeta label="Total neto a pagar" value={fmt(data.totalNeto)}     color="#00C896" />
            </div>

            {/* Estado y acciones */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <EstadoBadge estado={data.estado} />
              {data.estado === "BORRADOR" && (
                <button onClick={() => cambiarEstado("APROBADO")} disabled={cambiando} style={st.btnPri}>
                  ✓ Aprobar nómina
                </button>
              )}
              {data.estado === "APROBADO" && (
                <button onClick={() => cambiarEstado("PAGADO")} disabled={cambiando}
                  style={{ ...st.btnPri, background: "#00C896" }}>
                  B/. Marcar como pagada
                </button>
              )}
              {(data.estado === "APROBADO" || data.estado === "PAGADO") && (
                <button onClick={enviarComprobantes} disabled={enviando}
                  style={{ ...st.btnSec, color: "#9B59B6" }}>
                  {enviando ? "Enviando…" : "✉ Enviar comprobantes"}
                </button>
              )}
              {msgComprobante && (
                <span style={{ fontSize: 13, color: "#00C896" }}>{msgComprobante}</span>
              )}
            </div>

            {/* Tabla de líneas */}
            <div style={{ overflowX: "auto" }}>
              <table style={st.tabla}>
                <thead>
                  <tr>
                    {["Empleado", "Cédula", "Cargo", "Bruto", "CSS Emp.", "SEA Emp.", "ISR", "Otros desc.", "Total desc.", "Neto", "CSS Patr.", "SEA Patr.", ""].map((h) => (
                      <th key={h} style={st.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.lineas.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ ...st.td, fontWeight: 500 }}>{l.empleado.nombre} {l.empleado.apellido}</td>
                      <td style={{ ...st.td, fontFamily: "monospace", fontSize: 12 }}>{l.empleado.cedula}</td>
                      <td style={{ ...st.td, fontSize: 12, color: "#666" }}>{l.empleado.cargo}</td>
                      <td style={{ ...st.td, textAlign: "right" }}>{fmt(l.salarioBruto)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(l.cssEmpleado)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(l.seaEmpleado)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(l.isr)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(l.otrosDescuentos)}</td>
                      <td style={{ ...st.td, textAlign: "right", fontWeight: 600, color: "#FF6B6B" }}>{fmt(l.totalDeduccion)}</td>
                      <td style={{ ...st.td, textAlign: "right", fontWeight: 700, color: "#00C896" }}>{fmt(l.salarioNeto)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#F5A623" }}>{fmt(l.cssPatrono)}</td>
                      <td style={{ ...st.td, textAlign: "right", color: "#F5A623" }}>{fmt(l.seaPatrono)}</td>
                      <td style={st.td}>
                        {data.estado === "BORRADOR" && (
                          <button onClick={() => setEditLinea(l)} style={st.btnAcc}>Editar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Nota tasas */}
            <p style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>
              Tasas aplicadas: CSS empleado 9.75% · SEA empleado 1.25% · CSS patrono 12.25% · SEA patrono 1.50% ·
              ISR calculado sobre renta anual (exento hasta B/. 11,000 · 15% hasta B/. 100,000 · 25% sobre el excedente)
            </p>
          </>
        )}
      </div>
      {editLinea && (
        <ModalEditarLinea
          linea={editLinea}
          periodoId={periodo.id}
          onClose={() => setEditLinea(null)}
          onSuccess={cargar}
        />
      )}
    </div>
  );
}

// ── Modal editar línea de nómina ──────────────────────────────────────────────

function ModalEditarLinea({ linea, periodoId, onClose, onSuccess }) {
  const [otrosIngresos,   setIngresos]  = useState(String(Number(linea.otrosIngresos  ?? 0)));
  const [otrosDescuentos, setDescuentos] = useState(String(Number(linea.otrosDescuentos ?? 0)));
  const [notas, setNotas]               = useState(linea.notas ?? "");
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState(null);

  const bruto    = Number(linea.salarioBruto);
  const ingresos = Math.max(0, parseFloat(otrosIngresos)   || 0);
  const otros    = Math.max(0, parseFloat(otrosDescuentos) || 0);
  const css      = Number(linea.cssEmpleado);
  const sea      = Number(linea.seaEmpleado);
  const isr      = Number(linea.isr);
  const total    = css + sea + isr + otros;
  const neto     = bruto + ingresos - total;

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await api.patch(`/nomina/${periodoId}/lineas/${linea.id}`, {
        otrosIngresos:   ingresos,
        otrosDescuentos: otros,
        notas: notas.trim() || null,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al actualizar");
    } finally { setGuardando(false); }
  }

  const fmt = (n) => `B/. ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 440 }}>
        <h3 style={{ margin: "0 0 4px" }}>Ajustar línea de nómina</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          {linea.empleado.nombre} {linea.empleado.apellido} — {linea.empleado.cedula}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <label style={st.label}>Bonos / Horas extra (B/.)</label>
            <input style={st.input} type="number" min="0" step="0.01"
              value={otrosIngresos} onChange={(e) => setIngresos(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={st.label}>Descuentos adicionales (B/.)</label>
            <input style={st.input} type="number" min="0" step="0.01"
              value={otrosDescuentos} onChange={(e) => setDescuentos(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div style={{ background: "#f8f9fc", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 13 }}>
          {[
            ["Salario base", fmt(bruto), "#1a1a2e"],
            ...(ingresos > 0 ? [["Bonos / Horas extra", `+ ${fmt(ingresos)}`, "#00C896"]] : []),
            ["CSS empleado (9.75%)", `- ${fmt(css)}`, "#FF6B6B"],
            ["SEA empleado (1.25%)", `- ${fmt(sea)}`, "#FF6B6B"],
            ...(isr > 0 ? [["ISR", `- ${fmt(isr)}`, "#FF6B6B"]] : []),
            ...(otros > 0 ? [["Descuentos adicionales", `- ${fmt(otros)}`, "#FF6B6B"]] : []),
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #eee" }}>
              <span style={{ color: "#888" }}>{l}</span>
              <span style={{ color: c, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontWeight: 700, fontSize: 15 }}>
            <span>Neto a pagar</span>
            <span style={{ color: "#00C896" }}>{fmt(neto)}</span>
          </div>
        </div>

        <label style={st.label}>Notas</label>
        <textarea style={{ ...st.input, height: 56, resize: "vertical" }}
          value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Ausencia, préstamo, bono especial, etc." />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Guardar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pestaña Empleados ─────────────────────────────────────────────────────────

function TabEmpleados() {
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar]     = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modal, setModal]       = useState(null); // null | "nuevo" | empleado-obj

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) params.set("buscar", buscar);
      const r = await api.get(`/empleados?${params}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar]);

  async function desactivar(id) {
    if (!window.confirm("¿Desactivar este empleado?")) return;
    try { await api.delete(`/empleados/${id}`); cargar(); } catch { /* noop */ }
  }

  const total = data?.paginacion?.total ?? 0;
  const totalPag = data?.paginacion?.totalPaginas ?? 1;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 220, marginBottom: 0 }}
               placeholder="Buscar por nombre, cédula, cargo…"
               value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        {data?.datos?.length > 0 && (
          <button onClick={() => exportarCSV(data.datos, ["cedula","nombre","apellido","cargo","departamento","tipoContrato","periodoPago","salarioMensual","fechaIngreso"], ["Cédula","Nombre","Apellido","Cargo","Departamento","Contrato","Período Pago","Salario Mensual","Fecha Ingreso"], "empleados")} style={st.btnSec}>↓ CSV</button>
        )}
        <button onClick={() => setModal("nuevo")} style={st.btnPri}>+ Nuevo empleado</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay empleados registrados</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["Nombre completo", "Cédula", "Cargo", "Depto.", "Contrato", "Período pago", "Salario mensual", "Ingreso", "Acciones"].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ ...st.td, fontWeight: 500 }}>{e.nombre} {e.apellido}</td>
                    <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{e.cedula}</td>
                    <td style={st.td}>{e.cargo}</td>
                    <td style={{ ...st.td, color: "#888" }}>{e.departamento ?? "—"}</td>
                    <td style={st.td}>{e.tipoContrato}</td>
                    <td style={st.td}>{e.periodoPago}</td>
                    <td style={{ ...st.td, textAlign: "right", fontWeight: 600 }}>{fmt(e.salarioMensual)}</td>
                    <td style={st.td}>{fmtFecha(e.fechaIngreso)}</td>
                    <td style={{ ...st.td, whiteSpace: "nowrap" }}>
                      <button onClick={() => setModal(e)} style={st.btnAcc}>Editar</button>
                      <button onClick={() => desactivar(e.id)} style={{ ...st.btnAcc, marginLeft: 6, color: "#FF6B6B" }}>
                        Desactivar
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
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} empleados</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modal && (
        <ModalEmpleado
          empleado={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={cargar}
        />
      )}
    </>
  );
}

// ── Pestaña Nóminas ───────────────────────────────────────────────────────────

function TabNominas({ tipoFiltro }) {
  const [data, setData]           = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [pagina, setPagina]       = useState(1);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle]     = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina, limite: 10 });
      if (tipoFiltro) params.set("tipo", tipoFiltro);
      const r = await api.get(`/nomina?${params}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, tipoFiltro]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [tipoFiltro]);

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModalNuevo(true)} style={st.btnPri}>
          + Generar nómina {tipoFiltro === "DECIMO" ? "décimo 13°" : ""}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {cargando ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#888" }}>No hay nóminas generadas</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["Número", "Tipo", "Período", "Pago", "Empleados", "Total bruto", "Deducciones", "Total neto", "Estado", ""].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>{p.numero}</td>
                    <td style={st.td}>{p.tipo}</td>
                    <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(p.fechaInicio)} — {fmtFecha(p.fechaFin)}</td>
                    <td style={st.td}>{fmtFecha(p.fechaPago)}</td>
                    <td style={{ ...st.td, textAlign: "center" }}>{p.cantidadEmpleados}</td>
                    <td style={{ ...st.td, textAlign: "right" }}>{fmt(p.totalBruto)}</td>
                    <td style={{ ...st.td, textAlign: "right", color: "#FF6B6B" }}>{fmt(p.totalDeduccion)}</td>
                    <td style={{ ...st.td, textAlign: "right", fontWeight: 700, color: "#00C896" }}>{fmt(p.totalNeto)}</td>
                    <td style={st.td}><EstadoBadge estado={p.estado} /></td>
                    <td style={st.td}>
                      <button onClick={() => setDetalle(p)} style={st.btnAcc}>Ver detalle</button>
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
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Página {pagina} de {totalPag} — {total} registros</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modalNuevo && (
        <ModalPeriodo
          tipo={tipoFiltro || "REGULAR"}
          onClose={() => setModalNuevo(false)}
          onSuccess={cargar}
        />
      )}
      {detalle && (
        <ModalDetallePeriodo
          periodo={detalle}
          onClose={() => setDetalle(null)}
          onEstadoChange={cargar}
        />
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function NominaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "14px 24px",
                    display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 18 }}>GESTAR ERP</span>
        <span style={{ color: "#555", fontSize: 14 }}>/ Nómina Panamá</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 6px", color: "#1a1a2e" }}>Nómina Panamá</h2>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
          CSS 9.75% empleado · SEA 1.25% empleado · CSS 12.25% patrono · SEA 1.5% patrono · ISR automático
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #eee" }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
                fontWeight: tab === i ? 700 : 400,
                color: tab === i ? "#4E9AF1" : "#666",
                borderBottom: tab === i ? "2px solid #4E9AF1" : "2px solid transparent",
                marginBottom: -2, fontSize: 14,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && <TabEmpleados />}
        {tab === 1 && <TabNominas tipoFiltro="REGULAR" />}
        {tab === 2 && <TabNominas tipoFiltro="DECIMO" />}
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
