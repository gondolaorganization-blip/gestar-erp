import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"];
const TIPO_COLOR = {
  ACTIVO:     "#4E9AF1",
  PASIVO:     "#FF6B6B",
  PATRIMONIO: "#9B59B6",
  INGRESO:    "#00C896",
  GASTO:      "#F5A623",
};

const ESTADO_CFG = {
  BORRADOR: { color: "#888",    bg: "#f5f5f5",  label: "Borrador" },
  APROBADO: { color: "#00C896", bg: "#e6faf5",  label: "Aprobado" },
  ANULADO:  { color: "#FF6B6B", bg: "#fff0f0",  label: "Anulado"  },
};

const fmt = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-PA") : "—");

const TABS = ["Plan de Cuentas", "Asientos Contables"];

// ── Plan de Cuentas ───────────────────────────────────────────────────────────

function NodoCuenta({ nodo, nivel = 0, onEditar }) {
  const [abierto, setAbierto] = useState(nivel < 2);
  const tieneHijos = nodo.hijos?.length > 0;
  const color = TIPO_COLOR[nodo.tipo] ?? "#888";

  return (
    <div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px", paddingLeft: 14 + nivel * 22,
          borderBottom: "1px solid #f5f5f5",
          background: nivel === 0 ? "#f8f9fa" : "transparent",
          cursor: tieneHijos ? "pointer" : "default",
        }}
        onClick={() => tieneHijos && setAbierto((v) => !v)}
      >
        <span style={{ fontSize: 11, width: 14, color: "#aaa", flexShrink: 0 }}>
          {tieneHijos ? (abierto ? "▾" : "▸") : ""}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 12, color, minWidth: 70, fontWeight: 600 }}>
          {nodo.codigo}
        </span>
        <span style={{
          fontSize: nivel === 0 ? 13 : 13,
          fontWeight: nivel <= 1 ? 700 : 400,
          color: nivel === 0 ? color : "#1a1a2e",
          flex: 1,
        }}>
          {nodo.nombre}
        </span>
        <span style={{
          fontSize: 10, padding: "1px 7px", borderRadius: 8,
          background: color + "18", color,
          fontWeight: 600, marginRight: 8,
        }}>
          {nodo.tipo}
        </span>
        {nodo.acepta && (
          <span style={{ fontSize: 10, color: "#aaa", marginRight: 8 }}>acepta mvtos.</span>
        )}
        {nodo.acepta && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(nodo); }}
            style={st.btnAcc}
          >
            Editar
          </button>
        )}
      </div>
      {abierto && tieneHijos && (
        <div>
          {nodo.hijos.map((h) => (
            <NodoCuenta key={h.id} nodo={h} nivel={nivel + 1} onEditar={onEditar} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModalCuenta({ cuentas, cuenta, onClose, onSuccess }) {
  const [form, setForm] = useState(
    cuenta
      ? { nombre: cuenta.nombre, acepta: cuenta.acepta }
      : { codigo: "", nombre: "", tipo: "ACTIVO", nivel: "3", padre: "", acepta: true }
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const c = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    if (!form.nombre?.trim()) { setError("El nombre es requerido"); return; }
    if (!cuenta && !form.codigo?.trim()) { setError("El código es requerido"); return; }
    setGuardando(true);
    try {
      if (cuenta) {
        await api.put(`/contabilidad/cuentas/${cuenta.id}`, { nombre: form.nombre, acepta: form.acepta });
      } else {
        await api.post("/contabilidad/cuentas", {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          nivel: parseInt(form.nivel),
          padre: form.padre || null,
          acepta: form.acepta,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al guardar");
    } finally { setGuardando(false); }
  }

  // Cuentas padre disponibles (las que no aceptan movimientos directos, nivel < 3)
  const padreOpciones = cuentas.filter((c) => !c.acepta || c.nivel < 3);

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 440 }}>
        <h3 style={{ margin: "0 0 20px" }}>{cuenta ? "Editar cuenta" : "Nueva cuenta"}</h3>

        {!cuenta && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Código *</label>
                <input style={st.input} value={form.codigo}
                       onChange={(e) => c("codigo", e.target.value)} placeholder="5.2.11" />
              </div>
              <div>
                <label style={st.label}>Nivel</label>
                <select style={st.input} value={form.nivel} onChange={(e) => c("nivel", e.target.value)}>
                  <option value="1">1 — Grupo principal</option>
                  <option value="2">2 — Subgrupo</option>
                  <option value="3">3 — Cuenta detalle</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div>
                <label style={st.label}>Tipo</label>
                <select style={st.input} value={form.tipo} onChange={(e) => c("tipo", e.target.value)}>
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={st.label}>Cuenta padre</label>
                <select style={st.input} value={form.padre} onChange={(e) => c("padre", e.target.value)}>
                  <option value="">— Ninguna —</option>
                  {padreOpciones.map((p) => (
                    <option key={p.id} value={p.codigo}>{p.codigo} — {p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <label style={st.label}>Nombre *</label>
        <input style={st.input} value={form.nombre}
               onChange={(e) => c("nombre", e.target.value)} placeholder="Gastos de viaje" />

        <label style={{ ...st.label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={form.acepta}
                 onChange={(e) => c("acepta", e.target.checked)} />
          Acepta movimientos directos
        </label>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={st.btnPri}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabPlanCuentas() {
  const [arbol, setArbol]       = useState([]);
  const [plano, setPlano]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal]       = useState(null);
  const [semillando, setSemillando] = useState(false);
  const [msgSemilla, setMsgSemilla] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [aRes, pRes] = await Promise.all([
        api.get("/contabilidad/cuentas?arbol=true"),
        api.get("/contabilidad/cuentas"),
      ]);
      setArbol(aRes.data);
      setPlano(pRes.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cargarSemilla() {
    if (!window.confirm("¿Cargar el plan de cuentas estándar panameño? Solo funciona si la empresa no tiene cuentas aún.")) return;
    setSemillando(true);
    setMsgSemilla(null);
    try {
      const r = await api.post("/contabilidad/cuentas/semilla");
      setMsgSemilla({ ok: true, texto: r.data.mensaje });
      cargar();
    } catch (e) {
      setMsgSemilla({ ok: false, texto: e.response?.data?.error || "Error al cargar semilla" });
    } finally { setSemillando(false); }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setModal("nueva")} style={st.btnPri}>+ Nueva cuenta</button>
        <button onClick={cargarSemilla} disabled={semillando} style={st.btnSec}>
          {semillando ? "Cargando…" : "⬇ Cargar plan estándar Panamá"}
        </button>
        {msgSemilla && (
          <span style={{ fontSize: 13, color: msgSemilla.ok ? "#00C896" : "#FF6B6B" }}>
            {msgSemilla.texto}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {TIPOS.map((t) => (
          <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8,
                                  background: TIPO_COLOR[t] + "18", color: TIPO_COLOR[t], fontWeight: 700 }}>
            {t}
          </span>
        ))}
      </div>

      <div style={st.card}>
        {cargando ? (
          <p style={st.empty}>Cargando…</p>
        ) : arbol.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#888", marginBottom: 16 }}>No hay cuentas registradas.</p>
            <button onClick={cargarSemilla} style={st.btnPri}>Cargar plan estándar Panamá</button>
          </div>
        ) : (
          arbol.map((nodo) => (
            <NodoCuenta key={nodo.id} nodo={nodo} nivel={0} onEditar={(c) => setModal(c)} />
          ))
        )}
      </div>

      {modal && (
        <ModalCuenta
          cuentas={plano}
          cuenta={modal === "nueva" ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={cargar}
        />
      )}
    </>
  );
}

// ── Asientos Contables ────────────────────────────────────────────────────────

function ModalNuevoAsiento({ cuentas, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ fecha: hoy, descripcion: "", referencia: "" });
  const [lineas, setLineas] = useState([
    { cuentaId: "", descripcion: "", debe: "", haber: "" },
    { cuentaId: "", descripcion: "", debe: "", haber: "" },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cf = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cl = (i, k, v) => setLineas((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  function agregarLinea() {
    setLineas((ls) => [...ls, { cuentaId: "", descripcion: "", debe: "", haber: "" }]);
  }

  function quitarLinea(i) {
    if (lineas.length <= 2) return;
    setLineas((ls) => ls.filter((_, idx) => idx !== i));
  }

  const totalDebe  = lineas.reduce((s, l) => s + (parseFloat(l.debe)  || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;

  // Solo cuentas que aceptan movimientos
  const cuentasAcepta = cuentas.filter((c) => c.acepta);

  async function guardar() {
    setError(null);
    if (!form.descripcion.trim()) { setError("La descripción es requerida"); return; }
    if (!balanceado) { setError(`El asiento no está balanceado. Debe: ${fmt(totalDebe)} / Haber: ${fmt(totalHaber)}`); return; }
    for (const [i, l] of lineas.entries()) {
      if (!l.cuentaId) { setError(`Línea ${i + 1}: selecciona una cuenta`); return; }
    }
    setGuardando(true);
    try {
      await api.post("/contabilidad/asientos", {
        fecha: form.fecha,
        descripcion: form.descripcion.trim(),
        referencia: form.referencia || null,
        lineas: lineas.map((l) => ({
          cuentaId: parseInt(l.cuentaId),
          descripcion: l.descripcion || null,
          debe:  parseFloat(l.debe)  || 0,
          haber: parseFloat(l.haber) || 0,
        })),
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al crear asiento");
    } finally { setGuardando(false); }
  }

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 820 }}>
        <h3 style={{ margin: "0 0 20px" }}>Nuevo asiento contable</h3>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0 14px" }}>
          <div>
            <label style={st.label}>Descripción *</label>
            <input style={st.input} value={form.descripcion}
                   onChange={(e) => cf("descripcion", e.target.value)}
                   placeholder="Pago de alquiler enero…" />
          </div>
          <div>
            <label style={st.label}>Fecha *</label>
            <input style={st.input} type="date" value={form.fecha}
                   onChange={(e) => cf("fecha", e.target.value)} />
          </div>
          <div>
            <label style={st.label}>Referencia</label>
            <input style={st.input} value={form.referencia}
                   onChange={(e) => cf("referencia", e.target.value)}
                   placeholder="F-0042, OC-0010…" />
          </div>
        </div>

        {/* Encabezados de líneas */}
        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 2fr 100px 100px 28px",
                      gap: 8, marginBottom: 6 }}>
          {["Cuenta", "Descripción línea", "Debe (B/.)", "Haber (B/.)", ""].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>{h}</div>
          ))}
        </div>

        {/* Líneas */}
        {lineas.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 2fr 100px 100px 28px",
                                 gap: 8, marginBottom: 6 }}>
            <select style={{ ...st.input, marginBottom: 0 }}
                    value={l.cuentaId} onChange={(e) => cl(i, "cuentaId", e.target.value)}>
              <option value="">— Cuenta —</option>
              {TIPOS.map((tipo) => {
                const del_tipo = cuentasAcepta.filter((c) => c.tipo === tipo);
                if (!del_tipo.length) return null;
                return (
                  <optgroup key={tipo} label={tipo}>
                    {del_tipo.map((c) => (
                      <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <input style={{ ...st.input, marginBottom: 0 }} value={l.descripcion}
                   onChange={(e) => cl(i, "descripcion", e.target.value)} placeholder="Concepto…" />
            <input style={{ ...st.input, marginBottom: 0, textAlign: "right", color: "#4E9AF1" }}
                   type="number" min="0" step="0.01" value={l.debe}
                   onChange={(e) => { cl(i, "debe", e.target.value); if (e.target.value) cl(i, "haber", ""); }}
                   placeholder="0.00" />
            <input style={{ ...st.input, marginBottom: 0, textAlign: "right", color: "#FF6B6B" }}
                   type="number" min="0" step="0.01" value={l.haber}
                   onChange={(e) => { cl(i, "haber", e.target.value); if (e.target.value) cl(i, "debe", ""); }}
                   placeholder="0.00" />
            <button onClick={() => quitarLinea(i)} disabled={lineas.length <= 2}
                    style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer",
                             fontSize: 18, padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </div>
        ))}

        <button onClick={agregarLinea} style={{ ...st.btnSec, fontSize: 12, marginBottom: 16 }}>
          + Agregar línea
        </button>

        {/* Balance */}
        <div style={{ display: "flex", gap: 20, padding: "12px 16px", borderRadius: 10, marginBottom: 14,
                      background: balanceado ? "#e6faf5" : "#fff8ee",
                      border: `1px solid ${balanceado ? "#00C896" : "#F5A623"}` }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#888" }}>Total Debe</div>
            <div style={{ fontWeight: 700, color: "#4E9AF1", fontFamily: "monospace" }}>
              B/. {fmt(totalDebe)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#888" }}>Total Haber</div>
            <div style={{ fontWeight: 700, color: "#FF6B6B", fontFamily: "monospace" }}>
              B/. {fmt(totalHaber)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#888" }}>Diferencia</div>
            <div style={{ fontWeight: 800, color: balanceado ? "#00C896" : "#FF6B6B", fontFamily: "monospace" }}>
              {balanceado ? "✓ Balanceado" : `B/. ${fmt(Math.abs(totalDebe - totalHaber))}`}
            </div>
          </div>
        </div>

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || !balanceado} style={{
            ...st.btnPri,
            opacity: balanceado ? 1 : 0.5,
          }}>
            {guardando ? "Guardando…" : "Crear asiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDetalleAsiento({ asientoId, onClose, onCambioEstado }) {
  const [data, setData] = useState(null);
  const [accionando, setAccionando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get(`/contabilidad/asientos/${asientoId}`);
      setData(r.data);
    } catch { /* noop */ }
  }, [asientoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function aprobar() {
    setAccionando(true);
    try { await api.patch(`/contabilidad/asientos/${asientoId}/aprobar`); cargar(); onCambioEstado(); }
    catch { /* noop */ }
    finally { setAccionando(false); }
  }

  async function anular() {
    if (!window.confirm("¿Anular este asiento?")) return;
    setAccionando(true);
    try { await api.patch(`/contabilidad/asientos/${asientoId}/anular`); cargar(); onCambioEstado(); }
    catch { /* noop */ }
    finally { setAccionando(false); }
  }

  if (!data) return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 640, textAlign: "center", color: "#888" }}>Cargando…</div>
    </div>
  );

  const cfg = ESTADO_CFG[data.estado] ?? ESTADO_CFG.BORRADOR;

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, maxWidth: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Asiento N° {data.numero}</h3>
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
              {fmtFecha(data.fecha)}{data.referencia ? ` · ${data.referencia}` : ""}
            </p>
            <p style={{ color: "#555", fontSize: 14, margin: "4px 0 0" }}>{data.descripcion}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                           color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
            <button onClick={onClose} style={{ ...st.btnSec, padding: "4px 12px" }}>✕</button>
          </div>
        </div>

        {/* Tabla de líneas */}
        <table style={{ ...st.tabla, marginBottom: 16 }}>
          <thead>
            <tr>
              {["Cuenta", "Descripción", "Debe", "Haber"].map((h) => (
                <th key={h} style={st.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.lineas ?? []).map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={st.td}>
                  <span style={{ fontFamily: "monospace", fontSize: 12,
                                 color: TIPO_COLOR[l.cuenta?.tipo] ?? "#888" }}>
                    {l.cuenta?.codigo}
                  </span>
                  {" — "}
                  <span style={{ fontSize: 13 }}>{l.cuenta?.nombre}</span>
                </td>
                <td style={{ ...st.td, color: "#888", fontSize: 12 }}>{l.descripcion ?? "—"}</td>
                <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace",
                             color: l.debe > 0 ? "#4E9AF1" : "#ddd", fontWeight: l.debe > 0 ? 600 : 400 }}>
                  {l.debe > 0 ? `B/. ${fmt(l.debe)}` : "—"}
                </td>
                <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace",
                             color: l.haber > 0 ? "#FF6B6B" : "#ddd", fontWeight: l.haber > 0 ? 600 : 400 }}>
                  {l.haber > 0 ? `B/. ${fmt(l.haber)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #eee", background: "#f8f9fa" }}>
              <td colSpan={2} style={{ ...st.td, fontWeight: 700, fontSize: 12, color: "#555" }}>TOTALES</td>
              <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#4E9AF1" }}>
                B/. {fmt(data.totalDebe)}
              </td>
              <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#FF6B6B" }}>
                B/. {fmt(data.totalHaber)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Acciones de estado */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {data.estado === "BORRADOR" && (
            <>
              <button onClick={aprobar} disabled={accionando}
                style={{ ...st.btnPri, background: "#00C896" }}>
                ✓ Aprobar asiento
              </button>
              <button onClick={anular} disabled={accionando}
                style={{ ...st.btnSec, color: "#FF6B6B" }}>
                Anular
              </button>
            </>
          )}
          {data.estado === "APROBADO" && (
            <button onClick={anular} disabled={accionando}
              style={{ ...st.btnSec, color: "#FF6B6B" }}>
              Anular asiento aprobado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabAsientos() {
  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cuentas, setCuentas]   = useState([]);
  const [buscar, setBuscar]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde]       = useState("");
  const [hasta, setHasta]       = useState("");
  const [pagina, setPagina]     = useState(1);
  const [modalNuevo, setModalNuevo]   = useState(false);
  const [detalleId, setDetalleId]     = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ pagina, limite: 15 });
      if (buscar)       p.set("buscar", buscar);
      if (filtroEstado) p.set("estado", filtroEstado);
      if (desde)        p.set("desde", desde);
      if (hasta)        p.set("hasta", hasta);
      const [aRes, cRes] = await Promise.all([
        api.get(`/contabilidad/asientos?${p}`),
        api.get("/contabilidad/cuentas?soloAcepta=true"),
      ]);
      setData(aRes.data);
      setCuentas(cRes.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [pagina, buscar, filtroEstado, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado, desde, hasta]);

  const totalPag = data?.paginacion?.totalPaginas ?? 1;
  const total    = data?.paginacion?.total ?? 0;

  return (
    <>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input style={{ ...st.input, marginBottom: 0 }}
                 placeholder="Buscar descripción o referencia…"
                 value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <select style={{ ...st.input, minWidth: 130, marginBottom: 0 }}
                value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="BORRADOR">Borrador</option>
          <option value="APROBADO">Aprobado</option>
          <option value="ANULADO">Anulado</option>
        </select>
        <input style={{ ...st.input, width: 140, marginBottom: 0 }} type="date"
               value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="Desde" />
        <input style={{ ...st.input, width: 140, marginBottom: 0 }} type="date"
               value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="Hasta" />
        <button onClick={() => setModalNuevo(true)} style={st.btnPri}>+ Nuevo asiento</button>
      </div>

      <div style={st.card}>
        {cargando ? (
          <p style={st.empty}>Cargando…</p>
        ) : !data || data.datos.length === 0 ? (
          <p style={st.empty}>No hay asientos registrados</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={st.tabla}>
              <thead>
                <tr>
                  {["N°", "Fecha", "Descripción", "Referencia", "Debe", "Haber", "Estado", ""].map((h) => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((a) => {
                  const cfg = ESTADO_CFG[a.estado] ?? ESTADO_CFG.BORRADOR;
                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...st.td, fontFamily: "monospace", color: "#4E9AF1" }}>
                        #{String(a.numero).padStart(4, "0")}
                      </td>
                      <td style={{ ...st.td, fontSize: 12 }}>{fmtFecha(a.fecha)}</td>
                      <td style={{ ...st.td, maxWidth: 260 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.descripcion}
                        </span>
                        <span style={{ fontSize: 11, color: "#aaa" }}>
                          {a.lineas?.length ?? 0} líneas
                        </span>
                      </td>
                      <td style={{ ...st.td, fontSize: 12, color: "#888" }}>{a.referencia ?? "—"}</td>
                      <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace", color: "#4E9AF1", fontWeight: 600 }}>
                        {fmt(a.totalDebe)}
                      </td>
                      <td style={{ ...st.td, textAlign: "right", fontFamily: "monospace", color: "#FF6B6B", fontWeight: 600 }}>
                        {fmt(a.totalHaber)}
                      </td>
                      <td style={st.td}>
                        <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
                                       fontWeight: 700, color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={st.td}>
                        <button onClick={() => setDetalleId(a.id)} style={st.btnAcc}>Ver</button>
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
          <span style={{ lineHeight: "34px", fontSize: 13 }}>Pág. {pagina} / {totalPag} — {total} asientos</span>
          <button disabled={pagina === totalPag} onClick={() => setPagina((p) => p + 1)} style={st.btnSec}>Siguiente →</button>
        </div>
      )}

      {modalNuevo && (
        <ModalNuevoAsiento
          cuentas={cuentas}
          onClose={() => setModalNuevo(false)}
          onSuccess={cargar}
        />
      )}
      {detalleId && (
        <ModalDetalleAsiento
          asientoId={detalleId}
          onClose={() => setDetalleId(null)}
          onCambioEstado={cargar}
        />
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ContabilidadPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Contabilidad</span>
      </div>

      <div style={{ ...st.wrap, maxWidth: 1100 }}>
        <h2 style={st.h2}>Contabilidad General</h2>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
          Plan de cuentas · Partida doble · Asientos BORRADOR → APROBADO → ANULADO
        </p>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #eee" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ padding: "10px 22px", border: "none", background: "none", cursor: "pointer",
                       fontWeight: tab === i ? 700 : 400,
                       color: tab === i ? "#4E9AF1" : "#666",
                       borderBottom: tab === i ? "2px solid #4E9AF1" : "2px solid transparent",
                       marginBottom: -2, fontSize: 14 }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && <TabPlanCuentas />}
        {tab === 1 && <TabAsientos />}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const st = {
  header:     { background: "#1a1a2e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
  back:       { background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  brand:      { fontWeight: 700, fontSize: 18 },
  breadcrumb: { color: "#555", fontSize: 14 },
  wrap:       { padding: "24px 28px", maxWidth: 1100, margin: "0 auto" },
  h2:         { margin: "0 0 4px", color: "#1a1a2e" },
  card:       { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" },
  empty:      { padding: 40, textAlign: "center", color: "#888" },
  pag:        { display: "flex", gap: 8, justifyContent: "center", marginTop: 12 },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal:      { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.18)" },
  label:      { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:      { display: "block", width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPri:     { background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSec:     { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  btnAcc:     { background: "#f0f4ff", color: "#4E9AF1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  tabla:      { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th:         { background: "#f8f9fa", padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td:         { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
};
