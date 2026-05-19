import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `B/. ${Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtCant = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });

const ESTADO_CONFIG = {
  OK:        { label: "En stock",    color: "#00C896", bg: "#e6faf5" },
  BAJO:      { label: "Stock bajo",  color: "#F5A623", bg: "#fff8ee" },
  SIN_STOCK: { label: "Sin stock",   color: "#FF6B6B", bg: "#fff0f0" },
};

// ── Componentes menores ───────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.OK;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
      }}
    >
      {cfg.label}
    </span>
  );
}

function ResumenCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        borderLeft: `4px solid ${color}`,
        minWidth: 160,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
    </div>
  );
}

// ── Modal de movimiento ───────────────────────────────────────────────────────

function ModalMovimiento({ producto, onClose, onSuccess }) {
  const [form, setForm] = useState({
    tipo: "ENTRADA",
    cantidad: "",
    costoUnit: "",
    referencia: "",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setError(null);
    const cantNum = parseFloat(form.cantidad);
    if (!form.cantidad || isNaN(cantNum) || cantNum <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }
    setGuardando(true);
    try {
      const body = {
        tipo: form.tipo,
        cantidad: cantNum,
        referencia: form.referencia || undefined,
        notas: form.notas || undefined,
      };
      if (form.costoUnit) body.costoUnit = parseFloat(form.costoUnit);
      await api.post(`/inventario/${producto.id}/movimiento`, body);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al registrar movimiento");
    } finally {
      setGuardando(false);
    }
  }

  const labelCantidad =
    form.tipo === "AJUSTE" ? "Nuevo saldo (cantidad absoluta)" : "Cantidad";

  return (
    <div style={estilos.overlay}>
      <div style={{ ...estilos.modal, maxWidth: 480 }}>
        <h3 style={{ margin: "0 0 4px" }}>Registrar movimiento</h3>
        <p style={{ margin: "0 0 20px", color: "#666", fontSize: 14 }}>
          {producto.codigo} — {producto.nombre} &nbsp;|&nbsp; Stock actual:{" "}
          <strong>{fmtCant(producto.stock)}</strong>
        </p>

        <label style={estilos.label}>Tipo de movimiento</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["ENTRADA", "SALIDA", "AJUSTE"].map((t) => (
            <button
              key={t}
              onClick={() => cambiar("tipo", t)}
              style={{
                ...estilos.btnTipo,
                background: form.tipo === t ? "#4E9AF1" : "#f0f0f0",
                color: form.tipo === t ? "#fff" : "#333",
              }}
            >
              {t === "ENTRADA" ? "↑ Entrada" : t === "SALIDA" ? "↓ Salida" : "⇌ Ajuste"}
            </button>
          ))}
        </div>

        <label style={estilos.label}>{labelCantidad}</label>
        <input
          style={estilos.input}
          type="number"
          min="0"
          step="0.01"
          value={form.cantidad}
          onChange={(e) => cambiar("cantidad", e.target.value)}
          placeholder="0.00"
        />

        {form.tipo === "ENTRADA" && (
          <>
            <label style={estilos.label}>Costo unitario (opcional)</label>
            <input
              style={estilos.input}
              type="number"
              min="0"
              step="0.01"
              value={form.costoUnit}
              onChange={(e) => cambiar("costoUnit", e.target.value)}
              placeholder="0.00"
            />
          </>
        )}

        <label style={estilos.label}>Referencia (opcional)</label>
        <input
          style={estilos.input}
          value={form.referencia}
          onChange={(e) => cambiar("referencia", e.target.value)}
          placeholder="Ej: OC-001, FAC-042"
        />

        <label style={estilos.label}>Notas (opcional)</label>
        <textarea
          style={{ ...estilos.input, height: 72, resize: "vertical" }}
          value={form.notas}
          onChange={(e) => cambiar("notas", e.target.value)}
          placeholder="Observaciones..."
        />

        {error && <p style={{ color: "#FF6B6B", fontSize: 13, margin: "4px 0" }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={estilos.btnSecundario}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} style={estilos.btnPrimario}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de mínimo ───────────────────────────────────────────────────────────

function ModalMinimo({ producto, onClose, onSuccess }) {
  const [minimo, setMinimo] = useState(String(producto.stockMinimo || ""));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    setError(null);
    const n = parseFloat(minimo);
    if (isNaN(n) || n < 0) {
      setError("El stock mínimo debe ser mayor o igual a 0");
      return;
    }
    setGuardando(true);
    try {
      await api.patch(`/inventario/${producto.id}/minimo`, { stockMinimo: n });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || "Error al actualizar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={estilos.overlay}>
      <div style={{ ...estilos.modal, maxWidth: 360 }}>
        <h3 style={{ margin: "0 0 4px" }}>Stock mínimo</h3>
        <p style={{ margin: "0 0 20px", color: "#666", fontSize: 14 }}>
          {producto.nombre}
        </p>
        <label style={estilos.label}>Nivel mínimo de alerta</label>
        <input
          style={estilos.input}
          type="number"
          min="0"
          step="1"
          value={minimo}
          onChange={(e) => setMinimo(e.target.value)}
          placeholder="0"
          autoFocus
        />
        {error && <p style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={estilos.btnSecundario}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} style={estilos.btnPrimario}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Kardex ───────────────────────────────────────────────────────────

function ModalKardex({ producto: prod, onClose }) {
  const [data, setData] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get(`/inventario/${prod.id}?pagina=${pagina}&limite=30`);
      setData(r.data);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [prod.id, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const TIPO_COLOR = {
    ENTRADA: "#00C896",
    SALIDA:  "#FF6B6B",
    AJUSTE:  "#F5A623",
  };

  return (
    <div style={estilos.overlay}>
      <div style={{ ...estilos.modal, maxWidth: 720, width: "95vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            Kardex — {prod.nombre}
          </h3>
          <button onClick={onClose} style={{ ...estilos.btnSecundario, padding: "4px 12px" }}>
            ✕ Cerrar
          </button>
        </div>

        {cargando ? (
          <p style={{ color: "#888" }}>Cargando…</p>
        ) : !data ? (
          <p style={{ color: "#FF6B6B" }}>Error al cargar</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14 }}>
                Stock actual: <strong>{fmtCant(data.producto.stock)}</strong>
              </span>
              <span style={{ fontSize: 14 }}>
                Mínimo: <strong>{fmtCant(data.producto.stockMinimo)}</strong>
              </span>
              <EstadoBadge estado={data.producto.estadoStock} />
            </div>

            {data.kardex.length === 0 ? (
              <p style={{ color: "#888", textAlign: "center", padding: "30px 0" }}>
                Sin movimientos registrados
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={estilos.tabla}>
                  <thead>
                    <tr>
                      {["Fecha", "Tipo", "Cantidad", "Costo unit.", "Saldo", "Referencia", "Notas"].map((h) => (
                        <th key={h} style={estilos.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.kardex.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={estilos.td}>
                          {new Date(m.creadoEn).toLocaleDateString("es-PA")}
                        </td>
                        <td style={estilos.td}>
                          <span
                            style={{
                              color: TIPO_COLOR[m.tipo] ?? "#333",
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {m.tipo}
                          </span>
                        </td>
                        <td style={{ ...estilos.td, textAlign: "right" }}>
                          {fmtCant(m.cantidad)}
                        </td>
                        <td style={{ ...estilos.td, textAlign: "right" }}>
                          {m.costoUnit !== null ? fmt(m.costoUnit) : "—"}
                        </td>
                        <td style={{ ...estilos.td, textAlign: "right", fontWeight: 600 }}>
                          {fmtCant(m.saldoPost)}
                        </td>
                        <td style={estilos.td}>{m.referencia ?? "—"}</td>
                        <td style={{ ...estilos.td, color: "#888", fontSize: 12 }}>
                          {m.notas ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.paginacion.totalPaginas > 1 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <button
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                  style={estilos.btnSecundario}
                >
                  ← Anterior
                </button>
                <span style={{ lineHeight: "34px", fontSize: 13 }}>
                  {pagina} / {data.paginacion.totalPaginas}
                </span>
                <button
                  disabled={pagina === data.paginacion.totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  style={estilos.btnSecundario}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function InventarioPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalMov, setModalMov] = useState(null);
  const [modalMin, setModalMin] = useState(null);
  const [modalKardex, setModalKardex] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) params.set("buscar", buscar);
      if (filtroAlerta) params.set("alerta", filtroAlerta);
      const r = await api.get(`/inventario?${params}`);
      setData(r.data);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [pagina, buscar, filtroAlerta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Reset página al cambiar filtros
  useEffect(() => {
    setPagina(1);
  }, [buscar, filtroAlerta]);

  const resumen = data?.resumen;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      {/* Header */}
      <div
        style={{
          background: "#1a1a2e",
          color: "#fff",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: "#aaa",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 18 }}>GESTAR ERP</span>
        <span style={{ color: "#555", fontSize: 14 }}>/ Inventario</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 20px", color: "#1a1a2e" }}>Inventario de productos</h2>

        {/* Tarjetas de resumen */}
        {resumen && (
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <ResumenCard
              label="Total productos BIEN"
              value={resumen.totalProductos}
              color="#4E9AF1"
            />
            <ResumenCard
              label="Sin stock"
              value={resumen.sinStock}
              color="#FF6B6B"
            />
            <ResumenCard
              label="Stock bajo"
              value={resumen.bajoStock}
              color="#F5A623"
            />
            <ResumenCard
              label="Valor del inventario"
              value={fmt(resumen.valorTotal)}
              color="#00C896"
            />
          </div>
        )}

        {/* Filtros */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            marginBottom: 16,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            style={{ ...estilos.input, flex: 1, minWidth: 200, marginBottom: 0 }}
            placeholder="Buscar por código o nombre…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <select
            style={{ ...estilos.input, minWidth: 160, marginBottom: 0 }}
            value={filtroAlerta}
            onChange={(e) => setFiltroAlerta(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="bajo">Stock bajo</option>
            <option value="sin">Sin stock</option>
          </select>
          <button onClick={cargar} style={estilos.btnPrimario}>
            Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            overflow: "hidden",
          }}
        >
          {cargando ? (
            <p style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando…</p>
          ) : !data || data.datos.length === 0 ? (
            <p style={{ padding: 40, textAlign: "center", color: "#888" }}>
              No se encontraron productos de tipo BIEN
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={estilos.tabla}>
                <thead>
                  <tr>
                    {["Código", "Nombre", "Stock actual", "Mínimo", "Costo unit.", "Precio venta", "Estado", "Acciones"].map((h) => (
                      <th key={h} style={estilos.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.datos.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ ...estilos.td, fontFamily: "monospace", color: "#4E9AF1" }}>
                        {p.codigo}
                      </td>
                      <td style={{ ...estilos.td, fontWeight: 500 }}>{p.nombre}</td>
                      <td
                        style={{
                          ...estilos.td,
                          textAlign: "right",
                          fontWeight: 700,
                          color: p.estadoStock === "SIN_STOCK"
                            ? "#FF6B6B"
                            : p.estadoStock === "BAJO"
                            ? "#F5A623"
                            : "#1a1a2e",
                        }}
                      >
                        {fmtCant(p.stock)}
                      </td>
                      <td style={{ ...estilos.td, textAlign: "right", color: "#888" }}>
                        {fmtCant(p.stockMinimo)}
                      </td>
                      <td style={{ ...estilos.td, textAlign: "right" }}>
                        {p.costo !== null ? fmt(p.costo) : "—"}
                      </td>
                      <td style={{ ...estilos.td, textAlign: "right" }}>{fmt(p.precio)}</td>
                      <td style={estilos.td}>
                        <EstadoBadge estado={p.estadoStock} />
                      </td>
                      <td style={{ ...estilos.td, whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => setModalMov(p)}
                          style={estilos.btnAccion}
                          title="Registrar movimiento"
                        >
                          ± Mov.
                        </button>
                        <button
                          onClick={() => setModalMin(p)}
                          style={{ ...estilos.btnAccion, marginLeft: 6 }}
                          title="Configurar stock mínimo"
                        >
                          ⚙ Mín.
                        </button>
                        <button
                          onClick={() => setModalKardex(p)}
                          style={{ ...estilos.btnAccion, marginLeft: 6 }}
                          title="Ver kardex"
                        >
                          ☰ Kardex
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginación */}
        {data && data.paginacion.totalPaginas > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
              style={estilos.btnSecundario}
            >
              ← Anterior
            </button>
            <span style={{ lineHeight: "34px", fontSize: 13 }}>
              Página {pagina} de {data.paginacion.totalPaginas} —{" "}
              {data.paginacion.total} productos
            </span>
            <button
              disabled={pagina === data.paginacion.totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
              style={estilos.btnSecundario}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalMov && (
        <ModalMovimiento
          producto={modalMov}
          onClose={() => setModalMov(null)}
          onSuccess={cargar}
        />
      )}
      {modalMin && (
        <ModalMinimo
          producto={modalMin}
          onClose={() => setModalMin(null)}
          onSuccess={cargar}
        />
      )}
      {modalKardex && (
        <ModalKardex
          producto={modalKardex}
          onClose={() => setModalKardex(null)}
        />
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const estilos = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 8px 40px rgba(0,0,0,.18)",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    marginBottom: 6,
  },
  input: {
    display: "block",
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 14,
    boxSizing: "border-box",
    outline: "none",
  },
  btnPrimario: {
    background: "#4E9AF1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  btnSecundario: {
    background: "#f0f0f0",
    color: "#333",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
  },
  btnAccion: {
    background: "#f0f4ff",
    color: "#4E9AF1",
    border: "none",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  btnTipo: {
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    flex: 1,
  },
  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    background: "#f8f9fa",
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: "#666",
    borderBottom: "1px solid #eee",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "11px 14px",
    color: "#1a1a2e",
    verticalAlign: "middle",
  },
};
