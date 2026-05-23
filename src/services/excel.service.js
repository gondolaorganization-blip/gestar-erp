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

module.exports = { generarITBMSExcel, generarFacturasExcel, generarComprasExcel };
