const XLSX = require('xlsx');

const R2 = (n) => Number(Number(n ?? 0).toFixed(2));
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-PA') : '—';

function encabezado(wb, ws, titulo, empresa) {
  // Filas de encabezado ya incluidas en aoa_to_sheet; solo configurar metadatos del libro
  wb.Props = { Title: titulo, Company: empresa.nombre };
}

// ── ITBMS Excel ──────────────────────────────────────────────────────────────

function generarITBMSExcel(data, empresa, anio) {
  const wb = XLSX.utils.book_new();

  const rows = [
    [`DECLARACIÓN ITBMS — FORMULARIO 430 — AÑO ${anio}`],
    [`Empresa: ${empresa.nombre}`, '', '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['Mes', 'Ventas Gravadas (B/.)', 'Débito Fiscal 7% (B/.)', 'Compras Gravadas (B/.)', 'Crédito Fiscal (B/.)', 'ITBMS Neto (B/.)', 'Estado'],
    ...data.meses.map((m) => {
      const sin = m.debitoFiscal === 0 && m.creditoFiscal === 0;
      return [
        m.mes,
        R2(m.ventasGravadas),
        R2(m.debitoFiscal),
        R2(m.comprasGravadas),
        R2(m.creditoFiscal),
        R2(m.itbmsNeto),
        sin ? 'Sin movimiento' : m.itbmsNeto > 0 ? 'Por pagar' : 'A favor',
      ];
    }),
    ['TOTAL ANUAL', R2(data.totalVentas), R2(data.totalDebitoFiscal), R2(data.totalCompras), R2(data.totalCreditoFiscal), R2(data.totalNeto), ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 }];
  encabezado(wb, ws, `ITBMS ${anio}`, empresa);
  XLSX.utils.book_append_sheet(wb, ws, `ITBMS ${anio}`);

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Facturas Excel ────────────────────────────────────────────────────────────

function generarFacturasExcel(facturas, empresa) {
  const wb = XLSX.utils.book_new();

  const rows = [
    ['REPORTE DE FACTURAS'],
    [`Empresa: ${empresa.nombre}`, '', '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['N° Factura', 'Fecha', 'Fecha Vence', 'Cliente', 'Subtotal (B/.)', 'ITBMS (B/.)', 'Total (B/.)', 'Estado'],
    ...facturas.map((f) => [
      f.numero,
      fmtFecha(f.fecha),
      fmtFecha(f.fechaVence),
      f.cliente?.nombre ?? '—',
      R2(f.subtotal),
      R2(f.itbms),
      R2(f.total),
      f.estado,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  encabezado(wb, ws, 'Facturas', empresa);
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Compras Excel ─────────────────────────────────────────────────────────────

function generarComprasExcel(ordenes, empresa) {
  const wb = XLSX.utils.book_new();

  const rows = [
    ['REPORTE DE ÓRDENES DE COMPRA'],
    [`Empresa: ${empresa.nombre}`, '', '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['N° OC', 'Fecha', 'Fecha Vence', 'Proveedor', 'Subtotal (B/.)', 'ITBMS (B/.)', 'Total (B/.)', 'Estado'],
    ...ordenes.map((o) => [
      o.numero,
      fmtFecha(o.fecha),
      fmtFecha(o.fechaVence),
      o.proveedor?.nombre ?? '—',
      R2(o.subtotal),
      R2(o.itbms),
      R2(o.total),
      o.estado,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  encabezado(wb, ws, 'Compras', empresa);
  XLSX.utils.book_append_sheet(wb, ws, 'Órdenes de Compra');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── ISR Excel ─────────────────────────────────────────────────────────────────

function generarISRExcel(data, empresa, anio) {
  const wb = XLSX.utils.book_new();

  const rows = [
    [`PROYECCIÓN ISR — FORMULARIO 03 — AÑO ${anio}`],
    [`Empresa: ${empresa.nombre}`, '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['ESTADO DE RESULTADOS ESTIMADO'],
    ['Concepto', 'Monto (B/.)'],
    ['Ingresos brutos (ventas)', R2(data.ingresosAnuales)],
    ['(-) Egresos por compras', R2(data.egresosCompras)],
    ['(-) Egresos por nómina', R2(data.egresosNomina)],
    ['Utilidad / pérdida neta', R2(data.utilidadNeta)],
    [],
    ['CÁLCULO ISR — Art. 699 / 733-A Código Fiscal'],
    ['Método', 'Base de cálculo', 'ISR (B/.)'],
    ['Método A: 25% × renta neta', `25% × ${R2(Math.max(0, data.utilidadNeta))}`, R2(data.isrNormal)],
    ['Método B: CAIR 4.67% × renta bruta', `4.67% × ${R2(data.ingresosAnuales)}`, R2(data.cair)],
    [`ISR a pagar (${data.aplicaCair ? 'CAIR' : 'Método A'})`, '', R2(data.isrFinal)],
    ['Tasa efectiva sobre ingresos', '', `${Number(data.tasaEfectiva ?? 0).toFixed(2)}%`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 38 }, { wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, `ISR ${anio}`);
  wb.Props = { Title: `ISR ${anio}`, Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── CSS / SEA Excel ───────────────────────────────────────────────────────────

function generarCSSExcel(data, empresa, anio) {
  const wb = XLSX.utils.book_new();

  const rows = [
    [`OBLIGACIONES CSS / SEA — AÑO ${anio}`],
    [`Empresa: ${empresa.nombre}`, '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['Concepto', 'Tasa', 'Retención empleado (B/.)', 'Aporte patrono (B/.)'],
    ['CSS empleado', '9.75%', R2(data.totalCSSEmpleado), '—'],
    ['SEA empleado', '1.25%', R2(data.totalSEAEmpleado), '—'],
    ['ISR retenido en nómina', 'Variable', R2(data.totalISRNomina), '—'],
    ['CSS patronal', '12.25%', '—', R2(data.totalCSSPatrono)],
    ['SEA patronal', '1.50%', '—', R2(data.totalSEAPatrono)],
    ['TOTAL', '', R2(data.totalEmpleado + data.totalISRNomina), R2(data.totalPatrono)],
    [],
    ['Nota CSS', 'Cuotas CSS antes del día 15 del mes siguiente. Formulario CSS-03.'],
    ['Nota ISR nómina', 'ISR retenido en Formulario 1042 antes del día 15 del mes siguiente.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, `CSS-SEA ${anio}`);
  wb.Props = { Title: `CSS SEA ${anio}`, Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Balance General Excel ─────────────────────────────────────────────────────

function generarBalanceExcel(data, empresa) {
  const wb = XLSX.utils.book_new();

  const filas = [
    [`BALANCE GENERAL — Al: ${data.al}`],
    [`Empresa: ${empresa.nombre}`, '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
  ];

  const agregarSeccion = (titulo, cuentas) => {
    filas.push([titulo]);
    filas.push(['Código', 'Nombre', 'Saldo (B/.)']);
    (cuentas ?? []).filter(c => c.saldo !== 0).forEach(c => {
      filas.push([c.codigo, c.nombre, R2(c.saldo)]);
    });
    const total = (cuentas ?? []).reduce((s, c) => s + c.saldo, 0);
    filas.push([`Total ${titulo}`, '', R2(total)]);
    filas.push([]);
  };

  agregarSeccion('ACTIVOS', data.activos?.cuentas);
  agregarSeccion('PASIVOS', data.pasivos?.cuentas);
  agregarSeccion('PATRIMONIO', data.patrimonio?.cuentas);

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Balance General');
  wb.Props = { Title: 'Balance General', Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Estado de Resultados Excel ────────────────────────────────────────────────

function generarEstadoResultadosExcel(data, empresa) {
  const wb = XLSX.utils.book_new();

  const filas = [
    [`ESTADO DE RESULTADOS — ${data.periodo?.desde ?? ''} al ${data.periodo?.hasta ?? ''}`],
    [`Empresa: ${empresa.nombre}`, '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
  ];

  const agregarSeccion = (titulo, cuentas, total) => {
    filas.push([titulo]);
    filas.push(['Código', 'Nombre', 'Saldo (B/.)']);
    (cuentas ?? []).filter(c => c.saldo !== 0).forEach(c => {
      filas.push([c.codigo, c.nombre, R2(c.saldo)]);
    });
    filas.push([`Total ${titulo}`, '', R2(total)]);
    filas.push([]);
  };

  agregarSeccion('INGRESOS', data.ingresos?.cuentas, data.ingresos?.total);
  agregarSeccion('GASTOS', data.gastos?.cuentas, data.gastos?.total);
  filas.push([`${data.resultado ?? 'UTILIDAD'} NETA DEL PERÍODO`, '', R2(data.utilidadNeta)]);

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Estado de Resultados');
  wb.Props = { Title: 'Estado de Resultados', Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Libro Diario Excel ────────────────────────────────────────────────────────

function generarLibroDiarioExcel(data, empresa) {
  const wb = XLSX.utils.book_new();

  const filas = [
    [`LIBRO DIARIO — ${data.periodo?.desde ?? ''} al ${data.periodo?.hasta ?? ''}`],
    [`Empresa: ${empresa.nombre}`, '', '', '', `RUC: ${empresa.ruc ?? '—'}`],
    [`Generado: ${new Date().toLocaleDateString('es-PA')}`],
    [],
    ['Fecha', 'N° Asiento', 'Descripción', 'Referencia', 'Cuenta', 'Debe (B/.)', 'Haber (B/.)'],
  ];

  (data.asientos ?? []).forEach(a => {
    (a.lineas ?? []).forEach((l, li) => {
      filas.push([
        li === 0 ? fmtFecha(a.fecha) : '',
        li === 0 ? String(a.numero) : '',
        li === 0 ? a.descripcion : '',
        li === 0 ? (a.referencia ?? '—') : '',
        l.cuenta ?? '—',
        l.debe > 0 ? R2(l.debe) : '',
        l.haber > 0 ? R2(l.haber) : '',
      ]);
    });
  });

  if (data.totales) {
    filas.push([]);
    filas.push(['TOTALES', '', '', '', '', R2(data.totales.debe), R2(data.totales.haber)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario');
  wb.Props = { Title: 'Libro Diario', Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Antigüedad de Cartera Excel ───────────────────────────────────────────────

function generarCarteraExcel(data, empresa) {
  const wb = XLSX.utils.book_new();
  const tramos = ['corriente', 'dias30', 'dias60', 'dias90', 'mas90'];
  const labels = ['Corriente', '1-30 días', '31-60 días', '61-90 días', '+90 días'];

  const filas = [
    [`ANTIGÜEDAD DE CARTERA — Al: ${new Date().toLocaleDateString('es-PA')}`],
    [`Empresa: ${empresa.nombre}`, '', `RUC: ${empresa.ruc ?? '—'}`],
    [],
    ['Cliente', ...labels, 'Total (B/.)'],
    ...(data.clientes ?? []).map(c => [
      c.nombre,
      ...tramos.map(t => (c[t] ?? 0) > 0 ? R2(c[t]) : 0),
      R2(c.total),
    ]),
    ['TOTAL', ...tramos.map(t => R2((data.clientes ?? []).reduce((s, c) => s + (c[t] ?? 0), 0))),
      R2((data.clientes ?? []).reduce((s, c) => s + c.total, 0))],
  ];

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Antigüedad de Cartera');
  wb.Props = { Title: 'Antigüedad de Cartera', Company: empresa.nombre };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generarITBMSExcel,
  generarISRExcel,
  generarCSSExcel,
  generarFacturasExcel,
  generarComprasExcel,
  generarBalanceExcel,
  generarEstadoResultadosExcel,
  generarLibroDiarioExcel,
  generarCarteraExcel,
};
