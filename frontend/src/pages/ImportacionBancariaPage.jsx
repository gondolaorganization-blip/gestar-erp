import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// ── Constantes ────────────────────────────────────────────────────────────────

const BANCOS_PA = [
  "Banco General", "Banistmo", "BAC Credomatic", "Global Bank",
  "Multibank", "Banco Nacional de Panamá", "Caja de Ahorros",
  "Scotiabank", "Citibank", "Towerbank", "Otro",
];

const CONFIANZA_CFG = {
  ALTA:  { color: "#00C896", bg: "#e6faf5", label: "Alta" },
  MEDIA: { color: "#F5A623", bg: "#fff8ee", label: "Media" },
  BAJA:  { color: "#FF6B6B", bg: "#fff0f0", label: "Baja" },
};

const TIPO_CFG = {
  CREDITO: { color: "#00C896", label: "Crédito ↓" },
  DEBITO:  { color: "#FF6B6B", label: "Débito ↑"  },
};

const fmt = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Pasos ─────────────────────────────────────────────────────────────────────

const PASOS = ["Subir archivo", "Analizando con IA", "Revisar y ajustar", "Asientos creados"];

function StepBar({ paso }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
      {PASOS.map((p, i) => {
        const activo   = i === paso;
        const completo = i < paso;
        return (
          <div key={p} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13,
                background: completo ? "#00C896" : activo ? "#4E9AF1" : "#e8eaf0",
                color: completo || activo ? "#fff" : "#aaa",
                transition: "all 0.3s",
              }}>
                {completo ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: activo ? "#4E9AF1" : completo ? "#00C896" : "#aaa",
                             fontWeight: activo ? 700 : 400, whiteSpace: "nowrap" }}>{p}</span>
            </div>
            {i < PASOS.length - 1 && (
              <div style={{ width: 48, height: 2, background: completo ? "#00C896" : "#e8eaf0",
                            margin: "0 4px", marginBottom: 18, transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Paso 0: Upload ────────────────────────────────────────────────────────────

function PasoUpload({ onAnalizar }) {
  const [archivo, setArchivo]   = useState(null);
  const [banco, setBanco]       = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState(null);
  const inputRef = useRef();

  function handleFile(file) {
    setError(null);
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (![".pdf", ".xlsx", ".xls", ".csv", ".txt"].some((e) => ext.endsWith(e))) {
      setError("Formato no soportado. Usa PDF, Excel o CSV."); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo supera 20 MB."); return;
    }
    setArchivo(file);
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Zona drag & drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#4E9AF1" : archivo ? "#00C896" : "#ddd"}`,
          borderRadius: 16, padding: "48px 32px", textAlign: "center",
          cursor: "pointer", background: dragging ? "#f0f6ff" : archivo ? "#f0fff9" : "#fafafa",
          transition: "all 0.2s", marginBottom: 20,
        }}
      >
        <input ref={inputRef} type="file"
               accept=".pdf,.xlsx,.xls,.csv,.txt"
               style={{ display: "none" }}
               onChange={(e) => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 40, marginBottom: 12 }}>
          {archivo ? "✓" : "📄"}
        </div>
        {archivo ? (
          <>
            <div style={{ fontWeight: 700, color: "#00C896", fontSize: 15 }}>{archivo.name}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              {(archivo.size / 1024).toFixed(0)} KB — haz clic para cambiar
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#333", marginBottom: 6 }}>
              Arrastra tu estado de cuenta aquí
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              o haz clic para seleccionar
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["PDF", "Excel .xlsx", "Excel .xls", "CSV"].map((t) => (
                <span key={t} style={{ background: "#f0f0f0", borderRadius: 20, padding: "3px 10px",
                                       fontSize: 11, color: "#666", fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Selector de banco (hint para la IA) */}
      <div style={{ marginBottom: 20 }}>
        <label style={st.label}>
          Banco (opcional — ayuda a la IA a interpretar el formato)
        </label>
        <select style={st.input} value={banco} onChange={(e) => setBanco(e.target.value)}>
          <option value="">Detectar automáticamente</option>
          {BANCOS_PA.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Info box */}
      <div style={{ background: "#eef5ff", borderRadius: 10, padding: "12px 16px",
                    fontSize: 12, color: "#1a4a8a", marginBottom: 20 }}>
        <strong>¿Cómo exportar desde la banca en línea?</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          <li><strong>Banco General:</strong> Banca en Línea → Estado de Cuenta → Exportar Excel o PDF</li>
          <li><strong>Banistmo:</strong> Mi Banca → Cuentas → Movimientos → Descargar</li>
          <li><strong>BAC:</strong> E-Banking → Cuenta → Movimientos → Exportar</li>
          <li><strong>Cualquier banco:</strong> El formato CSV o Excel funciona mejor que PDF</li>
        </ul>
      </div>

      {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 12 }}>⚠ {error}</p>}

      <button
        disabled={!archivo}
        onClick={() => onAnalizar(archivo, banco)}
        style={{
          ...st.btnPri, width: "100%", fontSize: 15, padding: "13px",
          opacity: archivo ? 1 : 0.4, cursor: archivo ? "pointer" : "not-allowed",
        }}
      >
        ✦ Analizar con IA
      </button>
    </div>
  );
}

// ── Paso 1: Loading ───────────────────────────────────────────────────────────

function PasoAnalizando() {
  const pasos = [
    "Extrayendo transacciones del archivo…",
    "Identificando banco y período…",
    "Consultando tu Plan de Cuentas…",
    "Categorizando movimientos con IA…",
    "Verificando reglas contables panameñas…",
  ];
  const [idx, setIdx] = useState(0);

  useState(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % pasos.length), 2200);
    return () => clearInterval(t);
  });

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "40px 0" }}>
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 28px" }}>
        <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="#eef" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="#4E9AF1" strokeWidth="6"
                  strokeDasharray="213" strokeDashoffset="0"
                  style={{ animation: "spin 1.4s linear infinite" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 24 }}>✦</div>
      </div>
      <style>{`@keyframes spin { to { stroke-dashoffset: -213; } }`}</style>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>
        Analizando con IA…
      </div>
      <div style={{ fontSize: 13, color: "#888", minHeight: 20, transition: "all 0.3s" }}>
        {pasos[idx]}
      </div>
    </div>
  );
}

// ── Paso 2: Revisión ──────────────────────────────────────────────────────────

function SelectorCuenta({ value, onChange, cuentas }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      style={{ fontSize: 12, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6,
               width: "100%", outline: "none", background: "#fff" }}
    >
      <option value="">— Seleccionar —</option>
      {["ACTIVO","PASIVO","PATRIMONIO","INGRESO","GASTO"].map((tipo) => {
        const grupo = cuentas.filter((c) => c.tipo === tipo);
        if (!grupo.length) return null;
        return (
          <optgroup key={tipo} label={tipo}>
            {grupo.map((c) => (
              <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

function PasoRevision({ resultado, onConfirmar }) {
  const [filas, setFilas] = useState(
    resultado.transacciones.map((t, i) => ({ ...t, _id: i, incluir: true }))
  );
  const [creando, setCreando] = useState(false);
  const [error, setError]     = useState(null);

  const { cuentas } = resultado;

  function actualizar(id, campo, valor) {
    setFilas((fs) => fs.map((f) => f._id === id ? { ...f, [campo]: valor } : f));
  }

  const seleccionadas = filas.filter((f) => f.incluir);
  const totalCreditos = seleccionadas.filter((f) => f.tipo === "CREDITO").reduce((s, f) => s + Number(f.monto), 0);
  const totalDebitos  = seleccionadas.filter((f) => f.tipo === "DEBITO").reduce((s, f) => s + Number(f.monto), 0);

  async function crear() {
    setError(null);
    const payload = seleccionadas.filter((f) => f.cuentaDebeId && f.cuentaHaberId);
    if (!payload.length) { setError("No hay transacciones válidas seleccionadas"); return; }
    setCreando(true);
    try {
      await onConfirmar(payload);
    } catch (e) {
      setError(e.message || "Error al crear asientos");
      setCreando(false);
    }
  }

  return (
    <div>
      {/* Resumen del análisis */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px",
                    boxShadow: "0 1px 4px rgba(0,0,0,.08)", marginBottom: 16,
                    display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Banco detectado</div>
          <div style={{ fontWeight: 700, color: "#1a1a2e" }}>{resultado.banco}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Período</div>
          <div style={{ fontWeight: 700, color: "#1a1a2e" }}>{resultado.periodo || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Transacciones</div>
          <div style={{ fontWeight: 700, color: "#4E9AF1" }}>{filas.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Créditos (ingresos)</div>
          <div style={{ fontWeight: 700, color: "#00C896" }}>{fmt(totalCreditos)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Débitos (egresos)</div>
          <div style={{ fontWeight: 700, color: "#FF6B6B" }}>{fmt(totalDebitos)}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox"
                   checked={filas.every((f) => f.incluir)}
                   onChange={(e) => setFilas((fs) => fs.map((f) => ({ ...f, incluir: e.target.checked })))} />
            Seleccionar todo
          </label>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap", fontSize: 12, color: "#888" }}>
        {Object.entries(CONFIANZA_CFG).map(([k, v]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} />
            Confianza {v.label}
          </span>
        ))}
        <span style={{ color: "#aaa" }}>— Edita cualquier cuenta en las columnas Debe / Haber</span>
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                    overflow: "hidden", marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                {["", "Fecha", "Descripción bancaria", "Monto", "Tipo", "Cuenta DEBE", "Cuenta HABER", "Confianza IA"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11,
                                       fontWeight: 700, color: "#666", borderBottom: "1px solid #eee",
                                       whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const conf = CONFIANZA_CFG[f.confianza] ?? CONFIANZA_CFG.MEDIA;
                const tipo = TIPO_CFG[f.tipo] ?? TIPO_CFG.CREDITO;
                return (
                  <tr key={f._id} style={{
                    borderBottom: "1px solid #f5f5f5",
                    opacity: f.incluir ? 1 : 0.35,
                    background: f.incluir ? "transparent" : "#fafafa",
                  }}>
                    {/* Checkbox */}
                    <td style={{ padding: "8px 12px" }}>
                      <input type="checkbox" checked={f.incluir}
                             onChange={(e) => actualizar(f._id, "incluir", e.target.checked)} />
                    </td>
                    {/* Fecha */}
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap", fontSize: 12 }}>
                      <input type="date" value={f.fecha ?? ""}
                             onChange={(e) => actualizar(f._id, "fecha", e.target.value)}
                             style={{ border: "1px solid #eee", borderRadius: 4, padding: "2px 4px",
                                      fontSize: 12, outline: "none" }} />
                    </td>
                    {/* Descripción */}
                    <td style={{ padding: "8px 12px", maxWidth: 220 }}>
                      <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{f.descripcion}</div>
                      {f.razonamiento && (
                        <div style={{ fontSize: 10, color: "#aaa", marginTop: 2, lineHeight: 1.3 }}>
                          IA: {f.razonamiento}
                        </div>
                      )}
                    </td>
                    {/* Monto */}
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700,
                                 fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {fmt(f.monto)}
                    </td>
                    {/* Tipo */}
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                                     color: tipo.color, background: `${tipo.color}18` }}>{tipo.label}</span>
                    </td>
                    {/* Cuenta Debe */}
                    <td style={{ padding: "8px 12px", minWidth: 200 }}>
                      <SelectorCuenta
                        value={f.cuentaDebeId ?? ""}
                        onChange={(v) => actualizar(f._id, "cuentaDebeId", v)}
                        cuentas={cuentas}
                      />
                      {f.cuentaDebeCodigo && (
                        <div style={{ fontSize: 10, color: "#4E9AF1", marginTop: 2 }}>
                          {f.cuentaDebeCodigo} — {f.cuentaDebeNombre}
                        </div>
                      )}
                    </td>
                    {/* Cuenta Haber */}
                    <td style={{ padding: "8px 12px", minWidth: 200 }}>
                      <SelectorCuenta
                        value={f.cuentaHaberId ?? ""}
                        onChange={(v) => actualizar(f._id, "cuentaHaberId", v)}
                        cuentas={cuentas}
                      />
                      {f.cuentaHaberCodigo && (
                        <div style={{ fontSize: 10, color: "#9B59B6", marginTop: 2 }}>
                          {f.cuentaHaberCodigo} — {f.cuentaHaberNombre}
                        </div>
                      )}
                    </td>
                    {/* Confianza */}
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                                     color: conf.color, background: conf.bg }}>
                        {conf.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pie: advertencia + botón */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#888" }}>
          {seleccionadas.length} de {filas.length} transacciones seleccionadas ·{" "}
          Los asientos se crean en estado <strong>BORRADOR</strong> para que el contador los apruebe.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {error && <span style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</span>}
          <button onClick={crear} disabled={creando || !seleccionadas.length} style={{
            ...st.btnPri, opacity: seleccionadas.length ? 1 : 0.4,
            cursor: seleccionadas.length ? "pointer" : "not-allowed",
          }}>
            {creando ? "Creando asientos…" : `Crear ${seleccionadas.length} asiento(s) contable(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Paso 3: Éxito ─────────────────────────────────────────────────────────────

function PasoExito({ cantidad, onNuevo, onVerAsientos }) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "32px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: "#1a1a2e", marginBottom: 8 }}>{cantidad} asiento(s) creado(s)</h2>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Los asientos están en estado <strong>BORRADOR</strong>.<br />
        Ve a <strong>Contabilidad → Asientos</strong> para revisarlos y aprobarlos.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onVerAsientos} style={st.btnPri}>Ver asientos contables →</button>
        <button onClick={onNuevo} style={st.btnSec}>Importar otro estado de cuenta</button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ImportacionBancariaPage() {
  const navigate = useNavigate();
  const [paso, setPaso]           = useState(0);
  const [resultado, setResultado] = useState(null);
  const [cantCreados, setCantCreados] = useState(0);
  const [errGlobal, setErrGlobal] = useState(null);

  const analizar = useCallback(async (archivo, banco) => {
    setErrGlobal(null);
    setPaso(1);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      if (banco) fd.append("banco", banco);

      const r = await api.post("/importacion-bancaria/analizar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // 2 min — Claude puede tardar con archivos grandes
      });

      if (!r.data.transacciones?.length) {
        setErrGlobal("La IA no encontró transacciones en el archivo. Verifica que el archivo tenga movimientos de cuenta.");
        setPaso(0);
        return;
      }

      setResultado(r.data);
      setPaso(2);
    } catch (e) {
      setErrGlobal(e.response?.data?.error || "Error al analizar el archivo. Intenta de nuevo.");
      setPaso(0);
    }
  }, []);

  const confirmar = useCallback(async (transacciones) => {
    const r = await api.post("/importacion-bancaria/crear-asientos", { transacciones });
    setCantCreados(r.data.cantidad);
    setPaso(3);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={st.header}>
        <button onClick={() => navigate("/contabilidad")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Importación Bancaria con IA</span>
      </div>

      <div style={{ padding: "32px 28px", maxWidth: paso === 2 ? 1200 : 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 6px", color: "#1a1a2e", fontSize: 22 }}>
            Importación Bancaria con IA
          </h2>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
            Sube tu estado de cuenta de cualquier banco panameño — la IA categoriza los movimientos
            y sugiere los asientos contables automáticamente.
          </p>
        </div>

        <StepBar paso={paso} />

        {errGlobal && (
          <div style={{ background: "#fff0f0", border: "1px solid #FF6B6B33", borderRadius: 10,
                        padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#cc0000" }}>
            ⚠ {errGlobal}
          </div>
        )}

        {paso === 0 && <PasoUpload onAnalizar={analizar} />}
        {paso === 1 && <PasoAnalizando />}
        {paso === 2 && resultado && (
          <PasoRevision resultado={resultado} onConfirmar={confirmar} />
        )}
        {paso === 3 && (
          <PasoExito
            cantidad={cantCreados}
            onNuevo={() => { setPaso(0); setResultado(null); setErrGlobal(null); }}
            onVerAsientos={() => navigate("/contabilidad")}
          />
        )}
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
  label:      { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:      { display: "block", width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPri:     { background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnSec:     { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13 },
};
