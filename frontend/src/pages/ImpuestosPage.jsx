import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const fmt  = (n) => `B/. ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct  = (n) => `${Number(n ?? 0).toFixed(2)}%`;
const N    = (v) => Number(v ?? 0);

const TABS = ["ITBMS", "ISR", "CSS / SEA"];

const COLORES = {
  azul:   "#4E9AF1",
  verde:  "#00C896",
  rojo:   "#FF6B6B",
  ambar:  "#F5A623",
  morado: "#9B59B6",
};

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,.08)", borderLeft: `4px solid ${color}`,
      flex: 1, minWidth: 170,
    }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Tab ITBMS ──────────────────────────────────────────────────────────────────
function TabITBMS({ data }) {
  if (!data) return <p style={st.empty}>Sin datos</p>;
  const { meses, totalDebitoFiscal, totalCreditoFiscal, totalNeto, totalVentas } = data;
  const tasa = totalVentas > 0 ? (totalDebitoFiscal / totalVentas) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <KpiCard label="Débito Fiscal (ITBMS cobrado)" value={fmt(totalDebitoFiscal)} sub="Suma de ITBMS en facturas de venta" color={COLORES.azul} />
        <KpiCard label="Crédito Fiscal (ITBMS pagado)" value={fmt(totalCreditoFiscal)} sub="ITBMS en órdenes de compra recibidas" color={COLORES.verde} />
        <KpiCard label="ITBMS Neto a Pagar DGI" value={fmt(totalNeto)} sub="Débito − Crédito" color={totalNeto > 0 ? COLORES.rojo : COLORES.verde} />
        <KpiCard label="Tasa efectiva sobre ventas" value={pct(tasa)} sub="Referencia: tasa nominal 7%" color={COLORES.ambar} />
      </div>

      <div style={st.card}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0" }}>
          <strong style={{ color: "#1a1a2e" }}>Declaración Mensual ITBMS — Formulario 430</strong>
          <span style={{ fontSize: 12, color: "#888", marginLeft: 10 }}>Todos los meses del año</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={st.tabla}>
            <thead>
              <tr>
                {["Mes", "Ventas gravadas", "Débito fiscal (7%)", "Compras gravadas", "Crédito fiscal", "ITBMS neto", "Estado"].map((h) => (
                  <th key={h} style={st.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const neto = m.itbmsNeto;
                const sinMovimiento = m.debitoFiscal === 0 && m.creditoFiscal === 0;
                return (
                  <tr key={m.mes} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ ...st.td, fontWeight: 600 }}>{m.mes}</td>
                    <td style={{ ...st.td, textAlign: "right" }}>{m.ventasGravadas > 0 ? fmt(m.ventasGravadas) : "—"}</td>
                    <td style={{ ...st.td, textAlign: "right", color: COLORES.azul, fontWeight: 600 }}>
                      {m.debitoFiscal > 0 ? fmt(m.debitoFiscal) : "—"}
                    </td>
                    <td style={{ ...st.td, textAlign: "right" }}>{m.comprasGravadas > 0 ? fmt(m.comprasGravadas) : "—"}</td>
                    <td style={{ ...st.td, textAlign: "right", color: COLORES.verde }}>
                      {m.creditoFiscal > 0 ? fmt(m.creditoFiscal) : "—"}
                    </td>
                    <td style={{ ...st.td, textAlign: "right", fontWeight: 700,
                                 color: sinMovimiento ? "#ccc" : neto >= 0 ? COLORES.rojo : COLORES.verde }}>
                      {sinMovimiento ? "—" : fmt(neto)}
                    </td>
                    <td style={st.td}>
                      {sinMovimiento
                        ? <span style={{ fontSize: 11, color: "#bbb" }}>Sin movimiento</span>
                        : neto > 0
                          ? <span style={{ ...st.badge, color: COLORES.rojo, background: "#fff0f0" }}>Por pagar</span>
                          : <span style={{ ...st.badge, color: COLORES.verde, background: "#e6faf5" }}>A favor</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8f9fa", fontWeight: 700 }}>
                <td style={{ ...st.td }}>TOTAL ANUAL</td>
                <td style={{ ...st.td, textAlign: "right" }}>{fmt(data.totalVentas)}</td>
                <td style={{ ...st.td, textAlign: "right", color: COLORES.azul }}>{fmt(totalDebitoFiscal)}</td>
                <td style={{ ...st.td, textAlign: "right" }}>{fmt(data.totalCompras)}</td>
                <td style={{ ...st.td, textAlign: "right", color: COLORES.verde }}>{fmt(totalCreditoFiscal)}</td>
                <td style={{ ...st.td, textAlign: "right", color: totalNeto >= 0 ? COLORES.rojo : COLORES.verde }}>{fmt(totalNeto)}</td>
                <td style={st.td} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: "12px 16px", background: "#fffbe6", borderRadius: 10,
                    border: "1px solid #ffe68a", fontSize: 12, color: "#7a6000" }}>
        <strong>Nota DGI:</strong> El formulario 430 debe presentarse dentro de los primeros 15 días naturales del mes siguiente.
        La tasa general del ITBMS es 7%. Aplican tasas especiales de 10% (bebidas alcohólicas) y 15% (tabaco).
      </div>
    </div>
  );
}

// ── Tab ISR ────────────────────────────────────────────────────────────────────
function TabISR({ data }) {
  if (!data) return <p style={st.empty}>Sin datos</p>;
  const { ingresosAnuales, egresosAnuales, egresosCompras, egresosNomina,
          utilidadNeta, isrNormal, cair, isrFinal, aplicaCair, tasaEfectiva } = data;

  const filaIsr = [
    { label: "Ingresos brutos (ventas)",      valor: ingresosAnuales,  color: COLORES.verde,  bold: false },
    { label: "(-) Egresos por compras",        valor: -egresosCompras,  color: COLORES.rojo,   bold: false },
    { label: "(-) Egresos por nómina",         valor: -egresosNomina,   color: COLORES.rojo,   bold: false },
    { label: "Utilidad / pérdida neta",        valor: utilidadNeta,     color: utilidadNeta >= 0 ? COLORES.azul : COLORES.rojo, bold: true },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <KpiCard label="Ingresos anuales" value={fmt(ingresosAnuales)} sub="Subtotal facturas (sin ITBMS)" color={COLORES.verde} />
        <KpiCard label="Egresos anuales" value={fmt(egresosAnuales)} sub="Compras recibidas + nómina aprobada" color={COLORES.rojo} />
        <KpiCard label="Utilidad neta" value={fmt(utilidadNeta)} sub={utilidadNeta < 0 ? "Pérdida fiscal" : "Renta gravable estimada"} color={utilidadNeta >= 0 ? COLORES.azul : COLORES.rojo} />
        <KpiCard label="ISR proyectado" value={fmt(isrFinal)} sub={aplicaCair ? "Aplica CAIR (4.67% brutos)" : "25% sobre renta neta"} color={COLORES.ambar} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Estado de Resultados simplificado */}
        <div style={st.card}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0" }}>
            <strong style={{ color: "#1a1a2e" }}>Estado de resultados estimado</strong>
          </div>
          <table style={st.tabla}>
            <tbody>
              {filaIsr.map((r) => (
                <tr key={r.label} style={{ borderBottom: "1px solid #f9f9f9" }}>
                  <td style={{ ...st.td, fontWeight: r.bold ? 700 : 400 }}>{r.label}</td>
                  <td style={{ ...st.td, textAlign: "right", fontWeight: r.bold ? 700 : 400, color: r.color }}>
                    {fmt(Math.abs(r.valor))} {r.valor < 0 ? "(−)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cálculo ISR */}
        <div style={st.card}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0" }}>
            <strong style={{ color: "#1a1a2e" }}>Cálculo ISR — Art. 699 / 733-A Código Fiscal</strong>
          </div>
          <table style={st.tabla}>
            <tbody>
              {[
                { label: "Método A: 25% × renta neta",        valor: isrNormal, sub: `25% × ${fmt(Math.max(0, utilidadNeta))}` },
                { label: "Método B: CAIR 4.67% × renta bruta", valor: cair,      sub: `4.67% × ${fmt(ingresosAnuales)}` },
              ].map((r) => (
                <tr key={r.label} style={{ borderBottom: "1px solid #f9f9f9",
                  background: (r.label.startsWith("Método A") && !aplicaCair) ||
                               (r.label.startsWith("Método B") && aplicaCair) ? "#f0fff8" : "transparent" }}>
                  <td style={st.td}>
                    {r.label}
                    <div style={{ fontSize: 11, color: "#aaa" }}>{r.sub}</div>
                  </td>
                  <td style={{ ...st.td, textAlign: "right", fontWeight: 600 }}>{fmt(r.valor)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f8f9fa" }}>
                <td style={{ ...st.td, fontWeight: 700 }}>ISR a pagar (el mayor)</td>
                <td style={{ ...st.td, textAlign: "right", fontWeight: 700, color: COLORES.rojo, fontSize: 16 }}>
                  {fmt(isrFinal)}
                </td>
              </tr>
              <tr>
                <td style={{ ...st.td, fontSize: 12, color: "#888" }}>Tasa efectiva sobre ingresos</td>
                <td style={{ ...st.td, textAlign: "right", fontSize: 12, color: "#888" }}>{pct(tasaEfectiva)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: "12px 16px", background: "#fffbe6", borderRadius: 10,
                    border: "1px solid #ffe68a", fontSize: 12, color: "#7a6000" }}>
        <strong>Nota DGI:</strong> Este cálculo es una proyección estimada basada en los datos registrados en el sistema.
        La declaración anual del ISR (Formulario 03/06) debe presentarse antes del <strong>31 de marzo</strong> del año siguiente.
        Se recomienda verificar con un contador certificado (CPA) antes de presentar la declaración.
      </div>
    </div>
  );
}

// ── Tab CSS / SEA ──────────────────────────────────────────────────────────────
function TabCSS({ data }) {
  if (!data) return <p style={st.empty}>Sin datos</p>;
  const { totalCSSEmpleado, totalSEAEmpleado, totalISRNomina,
          totalCSSPatrono, totalSEAPatrono, totalEmpleado, totalPatrono } = data;

  const filas = [
    { concepto: "CSS empleado (9.75%)",    empleado: totalCSSEmpleado, patrono: null,            color: COLORES.azul  },
    { concepto: "SEA empleado (1.25%)",    empleado: totalSEAEmpleado, patrono: null,            color: COLORES.azul  },
    { concepto: "ISR retenido en nómina",  empleado: totalISRNomina,   patrono: null,            color: COLORES.ambar },
    { concepto: "CSS patronal (12.25%)",   empleado: null,             patrono: totalCSSPatrono, color: COLORES.rojo  },
    { concepto: "SEA patronal (1.50%)",    empleado: null,             patrono: totalSEAPatrono, color: COLORES.rojo  },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <KpiCard label="Total deducido a empleados" value={fmt(totalEmpleado)} sub="CSS + SEA retenidos en nómina" color={COLORES.azul} />
        <KpiCard label="ISR retenido en nómina" value={fmt(totalISRNomina)} sub="A enterar a la DGI mensualmente" color={COLORES.ambar} />
        <KpiCard label="Aporte patronal CSS/SEA" value={fmt(totalPatrono)} sub="Costo del empleador (12.25% + 1.5%)" color={COLORES.rojo} />
        <KpiCard label="Total obligaciones laborales" value={fmt(totalEmpleado + totalPatrono + totalISRNomina)} sub="CSS + SEA + ISR nómina" color={COLORES.morado} />
      </div>

      <div style={st.card}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0" }}>
          <strong style={{ color: "#1a1a2e" }}>Planilla CSS / SEA — Obligaciones del período</strong>
          <span style={{ fontSize: 12, color: "#888", marginLeft: 10 }}>Solo periodos aprobados</span>
        </div>
        <table style={st.tabla}>
          <thead>
            <tr>
              {["Concepto", "Tasa", "Retención empleado", "Aporte patrono"].map((h) => (
                <th key={h} style={st.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.concepto} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ ...st.td, fontWeight: 500 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                 background: f.color, marginRight: 8 }} />
                  {f.concepto}
                </td>
                <td style={{ ...st.td, fontSize: 12, color: "#888" }}>
                  {f.concepto.includes("CSS empleado") ? "9.75%"
                    : f.concepto.includes("SEA empleado") ? "1.25%"
                    : f.concepto.includes("CSS patronal") ? "12.25%"
                    : f.concepto.includes("SEA patronal") ? "1.50%"
                    : "Variable"}
                </td>
                <td style={{ ...st.td, textAlign: "right", color: f.empleado != null ? COLORES.azul : "#ccc" }}>
                  {f.empleado != null ? fmt(f.empleado) : "—"}
                </td>
                <td style={{ ...st.td, textAlign: "right", color: f.patrono != null ? COLORES.rojo : "#ccc" }}>
                  {f.patrono != null ? fmt(f.patrono) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f8f9fa", fontWeight: 700 }}>
              <td style={st.td} colSpan={2}>TOTAL</td>
              <td style={{ ...st.td, textAlign: "right", color: COLORES.azul }}>{fmt(totalEmpleado + totalISRNomina)}</td>
              <td style={{ ...st.td, textAlign: "right", color: COLORES.rojo }}>{fmt(totalPatrono)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 16px", background: "#eef5ff", borderRadius: 10,
                      border: "1px solid #c8deff", fontSize: 12, color: "#1a4a8a" }}>
          <strong>CSS:</strong> Las cuotas CSS deben enterarse a la Caja de Seguro Social dentro de los primeros
          15 días del mes siguiente. Formulario CSS-03.
        </div>
        <div style={{ padding: "12px 16px", background: "#fffbe6", borderRadius: 10,
                      border: "1px solid #ffe68a", fontSize: 12, color: "#7a6000" }}>
          <strong>ISR en nómina:</strong> La retención del ISR sobre salarios debe enterarse a la DGI
          en el formulario 1042 antes del día 15 del mes siguiente.
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function ImpuestosPage() {
  const navigate = useNavigate();
  const anioActual = new Date().getFullYear();
  const [anio, setAnio]       = useState(anioActual);
  const [tab, setTab]         = useState(0);
  const [data, setData]       = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get(`/impuestos?anio=${anio}`);
      setData(r.data);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const anios = Array.from({ length: 5 }, (_, i) => anioActual - i);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={st.header}>
        <button onClick={() => navigate("/dashboard")} style={st.back}>←</button>
        <span style={st.brand}>GESTAR ERP</span>
        <span style={st.breadcrumb}>/ Impuestos / DGI</span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={st.h2}>Impuestos / DGI Panamá</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 13, color: "#666" }}>Período fiscal:</label>
            <select style={{ ...st.input, width: 100, marginBottom: 0 }}
                    value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
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
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>

        {cargando
          ? <p style={st.empty}>Cargando datos fiscales…</p>
          : !data
            ? <p style={st.empty}>No se pudieron cargar los datos</p>
            : tab === 0 ? <TabITBMS data={data.itbms} />
            : tab === 1 ? <TabISR   data={data.isr}   />
            :             <TabCSS   data={data.css}   />
        }
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
  tabla:     { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:        { background: "#f8f9fa", padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td:        { padding: "11px 14px", color: "#1a1a2e", verticalAlign: "middle" },
  badge:     { padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 },
  input:     { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, outline: "none" },
};
