const PDFDocument = require('pdfkit');

const AZUL   = '#1a4f8a';
const GRIS   = '#f5f5f5';
const NEGRO  = '#222222';
const ROJO   = '#c0392b';

function R(n) { return Number(Number(n ?? 0).toFixed(2)); }
function fmt(n) { return `B/. ${R(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}` ; }
function fecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }

// ─── Cabecera común ──────────────────────────────────────────────────────────

function cabecera(doc, empresa, titulo) {
  // Banda azul superior
  doc.rect(0, 0, doc.page.width, 80).fill(AZUL);

  doc.fillColor('white')
    .fontSize(20).font('Helvetica-Bold')
    .text('GESTAR ERP', 40, 20)
    .fontSize(9).font('Helvetica')
    .text(empresa.nombre, 40, 46)
    .text(`RUC: ${empresa.ruc ?? '—'}`, 40, 58);

  doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
    .text(titulo, 0, 30, { align: 'right', width: doc.page.width - 40 });

  doc.fillColor(NEGRO).moveDown(3);
}

function lineaDivisor(doc, y) {
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
}

function pie(doc) {
  const y = doc.page.height - 40;
  doc.fontSize(7).fillColor('#888888')
    .text('Generado por GESTAR ERP — Sistema de Contabilidad y Gestión para Panamá',
      40, y, { align: 'center', width: doc.page.width - 80 });
}

// ─── PDF de FACTURA ──────────────────────────────────────────────────────────

function generarFacturaPDF(factura, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'FACTURA');

    // Datos factura + cliente
    const y0 = 100;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NEGRO)
      .text('NÚMERO:', 40, y0)
      .text('FECHA:', 40, y0 + 14)
      .text('VENCE:', 40, y0 + 28)
      .text('ESTADO:', 40, y0 + 42);

    doc.font('Helvetica').fillColor(NEGRO)
      .text(factura.numero, 110, y0)
      .text(fecha(factura.fecha), 110, y0 + 14)
      .text(fecha(factura.fechaVence), 110, y0 + 28)
      .text(factura.estado, 110, y0 + 42);

    // Caja cliente
    const xCliente = 320;
    doc.rect(xCliente, y0 - 4, doc.page.width - xCliente - 40, 64).fill(GRIS);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(AZUL)
      .text('CLIENTE', xCliente + 8, y0);
    doc.font('Helvetica').fillColor(NEGRO).fontSize(9)
      .text(factura.cliente?.nombre ?? '—', xCliente + 8, y0 + 14)
      .text(`${factura.cliente?.tipoDoc ?? ''}: ${factura.cliente?.numDoc ?? '—'}`, xCliente + 8, y0 + 28)
      .text(factura.cliente?.email ?? '', xCliente + 8, y0 + 42);

    // Tabla de líneas
    const yTabla = y0 + 80;
    doc.rect(40, yTabla, doc.page.width - 80, 18).fill(AZUL);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text('DESCRIPCIÓN',       50,  yTabla + 5)
      .text('CANT.',            290,  yTabla + 5)
      .text('PRECIO UNIT.',     340,  yTabla + 5)
      .text('ITBMS',            420,  yTabla + 5)
      .text('SUBTOTAL',         470,  yTabla + 5);

    let yFila = yTabla + 22;
    doc.fillColor(NEGRO).font('Helvetica').fontSize(8);

    (factura.lineas ?? []).forEach((l, i) => {
      if (i % 2 === 0) doc.rect(40, yFila - 3, doc.page.width - 80, 16).fill(GRIS).fillColor(NEGRO);
      doc.text(l.descripcion,           50,  yFila, { width: 230 })
         .text(String(R(l.cantidad)),   290, yFila)
         .text(fmt(l.precioUnit),       330, yFila)
         .text(l.itbms ? '7%' : '—',   420, yFila)
         .text(fmt(l.subtotal),         465, yFila);
      yFila += 18;
    });

    // Totales
    lineaDivisor(doc, yFila + 4);
    yFila += 12;
    const xLabel = 380; const xVal = 470;
    doc.fontSize(9).font('Helvetica');
    [
      ['Subtotal:',    factura.subtotal],
      ['ITBMS (7%):',  factura.itbms],
    ].forEach(([label, val]) => {
      doc.text(label, xLabel, yFila).text(fmt(val), xVal, yFila); yFila += 14;
    });

    lineaDivisor(doc, yFila + 2);
    yFila += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL)
      .text('TOTAL:', xLabel, yFila)
      .text(fmt(factura.total), xVal, yFila);

    // Notas
    if (factura.notas) {
      yFila += 30;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(NEGRO).text('Notas:', 40, yFila);
      doc.font('Helvetica').text(factura.notas, 40, yFila + 12, { width: 400 });
    }

    pie(doc);
    doc.end();
  });
}

// ─── PDF de BALANCE GENERAL ──────────────────────────────────────────────────

function generarBalancePDF(reporte, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'BALANCE GENERAL');

    doc.fontSize(10).font('Helvetica').fillColor('#555555')
      .text(`Al: ${reporte.al}`, 40, 100, { align: 'center', width: doc.page.width - 80 });

    let y = 125;
    const escribirSeccion = (titulo, { cuentas, total, utilidadEjercicio, resultadoEjercicio }) => {
      doc.rect(40, y, doc.page.width - 80, 18).fill(AZUL);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(titulo, 50, y + 5)
        .text('SALDO', doc.page.width - 130, y + 5);
      y += 22;

      cuentas.forEach((c, i) => {
        if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 14).fill(GRIS).fillColor(NEGRO);
        doc.fillColor(NEGRO).fontSize(8).font('Helvetica')
          .text(`${c.codigo}  ${c.nombre}`, 50, y, { width: 360 })
          .text(fmt(c.saldo), doc.page.width - 140, y, { align: 'right', width: 100 });
        y += 14;
      });

      if (utilidadEjercicio !== undefined) {
        const label = `${resultadoEjercicio} DEL EJERCICIO`;
        const color = utilidadEjercicio >= 0 ? AZUL : ROJO;
        doc.fillColor(color).fontSize(8).font('Helvetica-Oblique')
          .text(label, 50, y)
          .text(fmt(utilidadEjercicio), doc.page.width - 140, y, { align: 'right', width: 100 });
        y += 14;
      }

      lineaDivisor(doc, y + 2);
      y += 6;
      doc.fillColor(NEGRO).fontSize(9).font('Helvetica-Bold')
        .text(`Total ${titulo}:`, 50, y)
        .text(fmt(total), doc.page.width - 140, y, { align: 'right', width: 100 });
      y += 20;
    };

    escribirSeccion('ACTIVOS',    reporte.activos);
    escribirSeccion('PASIVOS',    reporte.pasivos);
    escribirSeccion('PATRIMONIO', reporte.patrimonio);

    lineaDivisor(doc, y);
    y += 8;
    doc.fillColor(AZUL).fontSize(10).font('Helvetica-Bold')
      .text('TOTAL PASIVO + PATRIMONIO:', 50, y)
      .text(fmt(reporte.totalPasivoPatrimonio), doc.page.width - 140, y, { align: 'right', width: 100 });

    const icono = reporte.ecuacionCuadra ? '✓ Ecuación contable cuadra' : '⚠ Diferencia detectada';
    doc.fontSize(8).fillColor(reporte.ecuacionCuadra ? '#27ae60' : ROJO)
      .text(icono, 50, y + 16);

    pie(doc);
    doc.end();
  });
}

// ─── PDF de ESTADO DE RESULTADOS ─────────────────────────────────────────────

function generarEstadoResultadosPDF(reporte, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'ESTADO DE RESULTADOS');

    doc.fontSize(10).font('Helvetica').fillColor('#555555')
      .text(`Período: ${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
        40, 100, { align: 'center', width: doc.page.width - 80 });

    let y = 130;
    const seccion = (titulo, cuentas, total, colorTotal) => {
      doc.rect(40, y, doc.page.width - 80, 18).fill(AZUL);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(titulo, 50, y + 5).text('MONTO', doc.page.width - 130, y + 5);
      y += 22;

      cuentas.forEach((c, i) => {
        if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 14).fill(GRIS).fillColor(NEGRO);
        doc.fillColor(NEGRO).fontSize(8).font('Helvetica')
          .text(`${c.codigo}  ${c.nombre}`, 50, y, { width: 360 })
          .text(fmt(c.saldo), doc.page.width - 140, y, { align: 'right', width: 100 });
        y += 14;
      });

      lineaDivisor(doc, y + 2); y += 6;
      doc.fillColor(colorTotal).fontSize(9).font('Helvetica-Bold')
        .text(`Total ${titulo}:`, 50, y)
        .text(fmt(total), doc.page.width - 140, y, { align: 'right', width: 100 });
      y += 22;
    };

    seccion('INGRESOS', reporte.ingresos.cuentas, reporte.ingresos.total, '#27ae60');
    seccion('GASTOS',   reporte.gastos.cuentas,   reporte.gastos.total,   ROJO);

    lineaDivisor(doc, y); y += 10;
    const colorUtil = reporte.utilidadNeta >= 0 ? '#27ae60' : ROJO;
    doc.fillColor(colorUtil).fontSize(13).font('Helvetica-Bold')
      .text(`${reporte.resultado} NETA DEL PERÍODO:`, 50, y)
      .text(fmt(reporte.utilidadNeta), doc.page.width - 140, y, { align: 'right', width: 100 });

    pie(doc);
    doc.end();
  });
}

// ─── PDF de ORDEN DE COMPRA ──────────────────────────────────────────────────

function generarOrdenCompraPDF(orden, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'ORDEN DE COMPRA');

    const y0 = 100;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NEGRO)
      .text('NÚMERO:',  40, y0)
      .text('FECHA:',   40, y0 + 14)
      .text('VENCE:',   40, y0 + 28)
      .text('ESTADO:',  40, y0 + 42);

    doc.font('Helvetica').fillColor(NEGRO)
      .text(orden.numero,              110, y0)
      .text(fecha(orden.fecha),        110, y0 + 14)
      .text(fecha(orden.fechaVence),   110, y0 + 28)
      .text(orden.estado,              110, y0 + 42);

    const xProv = 320;
    doc.rect(xProv, y0 - 4, doc.page.width - xProv - 40, 64).fill(GRIS);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(AZUL)
      .text('PROVEEDOR', xProv + 8, y0);
    doc.font('Helvetica').fillColor(NEGRO).fontSize(9)
      .text(orden.proveedor?.nombre ?? '—',    xProv + 8, y0 + 14)
      .text(`RUC: ${orden.proveedor?.ruc ?? '—'}`, xProv + 8, y0 + 28)
      .text(orden.proveedor?.email ?? '',      xProv + 8, y0 + 42);

    const yTabla = y0 + 80;
    doc.rect(40, yTabla, doc.page.width - 80, 18).fill(AZUL);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text('DESCRIPCIÓN',   50,  yTabla + 5)
      .text('CANT.',        290,  yTabla + 5)
      .text('PRECIO UNIT.', 340,  yTabla + 5)
      .text('ITBMS',        420,  yTabla + 5)
      .text('SUBTOTAL',     470,  yTabla + 5);

    let yFila = yTabla + 22;
    doc.fillColor(NEGRO).font('Helvetica').fontSize(8);

    (orden.lineas ?? []).forEach((l, i) => {
      if (i % 2 === 0) doc.rect(40, yFila - 3, doc.page.width - 80, 16).fill(GRIS).fillColor(NEGRO);
      doc.text(l.descripcion,           50,  yFila, { width: 230 })
         .text(String(R(l.cantidad)),   290, yFila)
         .text(fmt(l.precioUnit),       330, yFila)
         .text(l.itbms ? '7%' : '—',   420, yFila)
         .text(fmt(l.subtotal),         465, yFila);
      yFila += 18;
    });

    lineaDivisor(doc, yFila + 4);
    yFila += 12;
    const xLabel = 380; const xVal = 470;
    doc.fontSize(9).font('Helvetica');
    [['Subtotal:', orden.subtotal], ['ITBMS (7%):', orden.itbms]].forEach(([label, val]) => {
      doc.text(label, xLabel, yFila).text(fmt(val), xVal, yFila); yFila += 14;
    });

    lineaDivisor(doc, yFila + 2);
    yFila += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL)
      .text('TOTAL:', xLabel, yFila)
      .text(fmt(orden.total), xVal, yFila);

    if (orden.notas) {
      yFila += 30;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(NEGRO).text('Notas:', 40, yFila);
      doc.font('Helvetica').text(orden.notas, 40, yFila + 12, { width: 400 });
    }

    pie(doc);
    doc.end();
  });
}

// ─── Helper: tabla genérica ───────────────────────────────────────────────────

function tablaSimple(doc, startY, headers, rows, colWidths, totalsRow = null) {
  const x0 = 40;
  const tableW = colWidths.reduce((s, w) => s + w, 0);

  doc.rect(x0, startY, tableW, 16).fill(AZUL);
  let x = x0 + 4;
  headers.forEach((h, i) => {
    doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
       .text(h, x, startY + 5, { width: colWidths[i] - 4, align: i > 0 ? 'right' : 'left' });
    x += colWidths[i];
  });

  let y = startY + 18;
  rows.forEach((row, ri) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    if (ri % 2 === 0) doc.rect(x0, y - 2, tableW, 14).fill(GRIS);
    x = x0 + 4;
    row.forEach((cell, ci) => {
      doc.fillColor(NEGRO).fontSize(7).font('Helvetica')
         .text(String(cell ?? '—'), x, y, { width: colWidths[ci] - 4, align: ci > 0 ? 'right' : 'left' });
      x += colWidths[ci];
    });
    y += 14;
  });

  if (totalsRow) {
    doc.rect(x0, y - 2, tableW, 16).fill('#e8edf8');
    x = x0 + 4;
    totalsRow.forEach((cell, ci) => {
      doc.fillColor(AZUL).fontSize(7).font('Helvetica-Bold')
         .text(String(cell ?? ''), x, y + 2, { width: colWidths[ci] - 4, align: ci > 0 ? 'right' : 'left' });
      x += colWidths[ci];
    });
    y += 18;
  }

  return y;
}

// ─── PDF de ITBMS ─────────────────────────────────────────────────────────────

function generarITBMSPDF(data, empresa, anio) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, `DECLARACIÓN ITBMS — F-430`);
    doc.fontSize(10).font('Helvetica').fillColor('#555')
       .text(`Período fiscal: ${anio}`, 40, 100, { align: 'center', width: doc.page.width - 80 });

    let y = 122;
    const kpiW = (doc.page.width - 84) / 3;
    [
      { label: 'Débito Fiscal Total', value: fmt(data.totalDebitoFiscal) },
      { label: 'Crédito Fiscal Total', value: fmt(data.totalCreditoFiscal) },
      { label: 'ITBMS Neto a Pagar DGI', value: fmt(data.totalNeto) },
    ].forEach((k, i) => {
      const kx = 40 + i * (kpiW + 2);
      doc.rect(kx, y, kpiW, 36).fill(GRIS);
      doc.fontSize(7).font('Helvetica').fillColor('#666').text(k.label, kx + 6, y + 5, { width: kpiW - 12 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(NEGRO).text(k.value, kx + 6, y + 17, { width: kpiW - 12 });
    });
    y += 50;

    const headers  = ['Mes', 'Ventas gravadas', 'Débito fiscal 7%', 'Compras gravadas', 'Crédito fiscal', 'ITBMS neto', 'Estado'];
    const colWidths = [46, 83, 83, 83, 78, 74, 53];
    const rows = data.meses.map((m) => {
      const sin = m.debitoFiscal === 0 && m.creditoFiscal === 0;
      return [m.mes, m.ventasGravadas > 0 ? fmt(m.ventasGravadas) : '—',
              m.debitoFiscal > 0 ? fmt(m.debitoFiscal) : '—',
              m.comprasGravadas > 0 ? fmt(m.comprasGravadas) : '—',
              m.creditoFiscal > 0 ? fmt(m.creditoFiscal) : '—',
              sin ? '—' : fmt(m.itbmsNeto),
              sin ? 'Sin mov.' : m.itbmsNeto > 0 ? 'Por pagar' : 'A favor'];
    });
    const totals = ['TOTAL ANUAL', fmt(data.totalVentas), fmt(data.totalDebitoFiscal),
                    fmt(data.totalCompras), fmt(data.totalCreditoFiscal), fmt(data.totalNeto), ''];

    y = tablaSimple(doc, y, headers, rows, colWidths, totals);
    y += 14;
    doc.rect(40, y, doc.page.width - 80, 26).fill('#fffbe6');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#7a6000').text('Nota DGI:', 46, y + 5);
    doc.font('Helvetica').text(
      'El Formulario 430 debe presentarse dentro de los primeros 15 días del mes siguiente. Tasa general ITBMS: 7%.',
      46, y + 14, { width: doc.page.width - 92 });

    pie(doc);
    doc.end();
  });
}

// ─── PDF de ISR ───────────────────────────────────────────────────────────────

function generarISRPDF(data, empresa, anio) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, `PROYECCIÓN ISR — F-03`);
    doc.fontSize(10).font('Helvetica').fillColor('#555')
       .text(`Período fiscal: ${anio}`, 40, 100, { align: 'center', width: doc.page.width - 80 });

    let y = 122;
    const kpiW = (doc.page.width - 84) / 4;
    [
      { label: 'Ingresos anuales',  value: fmt(data.ingresosAnuales) },
      { label: 'Egresos anuales',   value: fmt(data.egresosAnuales) },
      { label: 'Utilidad neta',     value: fmt(data.utilidadNeta) },
      { label: 'ISR proyectado',    value: fmt(data.isrFinal) },
    ].forEach((k, i) => {
      const kx = 40 + i * (kpiW + 2);
      doc.rect(kx, y, kpiW, 36).fill(GRIS);
      doc.fontSize(7).font('Helvetica').fillColor('#666').text(k.label, kx + 6, y + 5, { width: kpiW - 12 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(NEGRO).text(k.value, kx + 6, y + 17, { width: kpiW - 12 });
    });
    y += 50;

    // Estado de resultados simplificado
    doc.fontSize(9).font('Helvetica-Bold').fillColor(AZUL).text('ESTADO DE RESULTADOS ESTIMADO', 40, y); y += 14;
    const colsER = [320, 180];
    const rowsER = [
      ['Ingresos brutos (ventas)', fmt(data.ingresosAnuales)],
      ['(-) Egresos por compras', fmt(data.egresosCompras)],
      ['(-) Egresos por nómina', fmt(data.egresosNomina)],
      ['Utilidad / pérdida neta', fmt(data.utilidadNeta)],
    ];
    y = tablaSimple(doc, y, ['Concepto', 'Monto'], rowsER, colsER);
    y += 14;

    // Cálculo ISR
    doc.fontSize(9).font('Helvetica-Bold').fillColor(AZUL)
       .text('CÁLCULO ISR — Art. 699 / 733-A Código Fiscal', 40, y); y += 14;
    const colsISR = [260, 140, 100];
    const rowsISR = [
      ['Método A: 25% × renta neta', `25% × ${fmt(Math.max(0, data.utilidadNeta))}`, fmt(data.isrNormal)],
      ['Método B: CAIR 4.67% × renta bruta', `4.67% × ${fmt(data.ingresosAnuales)}`, fmt(data.cair)],
      [`ISR a pagar (el mayor — ${data.aplicaCair ? 'CAIR' : 'Método A'})`, '', fmt(data.isrFinal)],
      ['Tasa efectiva sobre ingresos', '', `${Number(data.tasaEfectiva ?? 0).toFixed(2)}%`],
    ];
    y = tablaSimple(doc, y, ['Método', 'Base de cálculo', 'ISR'], rowsISR, colsISR);
    y += 14;
    doc.rect(40, y, doc.page.width - 80, 26).fill('#fffbe6');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#7a6000').text('Nota DGI:', 46, y + 5);
    doc.font('Helvetica').text(
      'Proyección estimada. La declaración anual (Formulario 03/06) debe presentarse antes del 31 de marzo del año siguiente. Verificar con CPA.',
      46, y + 14, { width: doc.page.width - 92 });

    pie(doc);
    doc.end();
  });
}

// ─── PDF de CSS / SEA ─────────────────────────────────────────────────────────

function generarCSSPDF(data, empresa, anio) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, `OBLIGACIONES CSS / SEA`);
    doc.fontSize(10).font('Helvetica').fillColor('#555')
       .text(`Período fiscal: ${anio}`, 40, 100, { align: 'center', width: doc.page.width - 80 });

    let y = 122;
    const kpiW = (doc.page.width - 84) / 4;
    [
      { label: 'Deducción empleados',   value: fmt(data.totalEmpleado) },
      { label: 'ISR retenido nómina',   value: fmt(data.totalISRNomina) },
      { label: 'Aporte patronal',        value: fmt(data.totalPatrono) },
      { label: 'Total obligaciones',     value: fmt(data.totalEmpleado + data.totalPatrono + data.totalISRNomina) },
    ].forEach((k, i) => {
      const kx = 40 + i * (kpiW + 2);
      doc.rect(kx, y, kpiW, 36).fill(GRIS);
      doc.fontSize(7).font('Helvetica').fillColor('#666').text(k.label, kx + 6, y + 5, { width: kpiW - 12 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(NEGRO).text(k.value, kx + 6, y + 17, { width: kpiW - 12 });
    });
    y += 50;

    const colsCSS = [200, 80, 140, 130];
    const rowsCSS = [
      ['CSS empleado', '9.75%', fmt(data.totalCSSEmpleado), '—'],
      ['SEA empleado', '1.25%', fmt(data.totalSEAEmpleado), '—'],
      ['ISR retenido en nómina', 'Variable', fmt(data.totalISRNomina), '—'],
      ['CSS patronal', '12.25%', '—', fmt(data.totalCSSPatrono)],
      ['SEA patronal', '1.50%', '—', fmt(data.totalSEAPatrono)],
    ];
    const totalsCSS = ['TOTAL', '', fmt(data.totalEmpleado + data.totalISRNomina), fmt(data.totalPatrono)];
    y = tablaSimple(doc, y, ['Concepto', 'Tasa', 'Retención empleado', 'Aporte patrono'], rowsCSS, colsCSS, totalsCSS);
    y += 14;

    const notas = [
      { color: '#1a4a8a', bg: '#eef5ff', border: '#c8deff', text: 'CSS: Las cuotas CSS deben enterarse a la Caja de Seguro Social dentro de los primeros 15 días del mes siguiente. Formulario CSS-03.' },
      { color: '#7a6000', bg: '#fffbe6', border: '#ffe68a', text: 'ISR en nómina: La retención del ISR sobre salarios debe enterarse a la DGI en el Formulario 1042 antes del día 15 del mes siguiente.' },
    ];
    const halfW = (doc.page.width - 88) / 2;
    notas.forEach((n, i) => {
      const nx = 40 + i * (halfW + 8);
      doc.rect(nx, y, halfW, 30).fill(n.bg);
      doc.fontSize(7).font('Helvetica').fillColor(n.color)
         .text(n.text, nx + 6, y + 4, { width: halfW - 12 });
    });

    pie(doc);
    doc.end();
  });
}

// ─── PDF de LIBRO DIARIO ─────────────────────────────────────────────────────

function generarLibroDiarioPDF(data, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'LIBRO DIARIO');
    if (data.periodo) {
      doc.fontSize(9).font('Helvetica').fillColor('#555')
         .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, 40, 100, { align: 'center', width: doc.page.width - 80 });
    }

    let y = 120;
    const colsLD = [60, 50, 160, 80, 130, 60, 60];
    const headers = ['Fecha', 'Asiento', 'Descripción', 'Referencia', 'Cuenta', 'Debe', 'Haber'];

    doc.rect(40, y, colsLD.reduce((s, w) => s + w, 0), 16).fill(AZUL);
    let x = 44;
    headers.forEach((h, i) => {
      doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
         .text(h, x, y + 5, { width: colsLD[i] - 4, align: i >= 5 ? 'right' : 'left' });
      x += colsLD[i];
    });
    y += 18;

    (data.asientos ?? []).forEach((a, ai) => {
      (a.lineas ?? []).forEach((l, li) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
        if (ai % 2 === 0) doc.rect(40, y - 2, colsLD.reduce((s, w) => s + w, 0), 14).fill(GRIS);
        x = 44;
        const fila = li === 0
          ? [fecha(a.fecha), String(a.numero), a.descripcion, a.referencia ?? '—']
          : ['', '', '', ''];
        const celdas = [...fila, l.cuenta ?? '—',
          l.debe > 0 ? fmt(l.debe) : '',
          l.haber > 0 ? fmt(l.haber) : ''];
        celdas.forEach((cell, ci) => {
          doc.fillColor(NEGRO).fontSize(7).font('Helvetica')
             .text(cell, x, y, { width: colsLD[ci] - 4, align: ci >= 5 ? 'right' : 'left' });
          x += colsLD[ci];
        });
        y += 14;
      });
    });

    if (data.totales) {
      const tw = colsLD.reduce((s, w) => s + w, 0);
      doc.rect(40, y - 2, tw, 16).fill('#e8edf8');
      x = 44;
      ['TOTALES', '', '', '', '', fmt(data.totales.debe), fmt(data.totales.haber)].forEach((cell, ci) => {
        doc.fillColor(AZUL).fontSize(7).font('Helvetica-Bold')
           .text(cell, x, y + 2, { width: colsLD[ci] - 4, align: ci >= 5 ? 'right' : 'left' });
        x += colsLD[ci];
      });
    }

    pie(doc);
    doc.end();
  });
}

// ─── PDF de ANTIGÜEDAD DE CARTERA ────────────────────────────────────────────

function generarCarteraPDF(data, empresa) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    cabecera(doc, empresa, 'ANTIGÜEDAD DE CARTERA');
    doc.fontSize(9).font('Helvetica').fillColor('#555')
       .text(`Al: ${new Date().toLocaleDateString('es-PA')}`, 40, 100, { align: 'center', width: doc.page.width - 80 });

    const tramos = ['corriente', 'dias30', 'dias60', 'dias90', 'mas90'];
    const labels = ['Corriente', '1-30 días', '31-60 días', '61-90 días', '+90 días'];

    let y = 120;
    const kpiW = (doc.page.width - 84) / 5;
    tramos.forEach((t, i) => {
      const monto = (data.clientes ?? []).reduce((s, c) => s + (c[t] ?? 0), 0);
      const kx = 40 + i * (kpiW + 2);
      doc.rect(kx, y, kpiW, 36).fill(GRIS);
      doc.fontSize(7).font('Helvetica').fillColor('#666').text(labels[i], kx + 6, y + 5, { width: kpiW - 12 });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(NEGRO).text(fmt(monto), kx + 6, y + 17, { width: kpiW - 12 });
    });
    y += 50;

    const colsCart = [140, 68, 68, 68, 68, 68, 70];
    const rows = (data.clientes ?? []).map((c) => [
      c.nombre,
      ...tramos.map((t) => (c[t] ?? 0) > 0 ? fmt(c[t]) : '—'),
      fmt(c.total),
    ]);
    const totalsCart = ['TOTAL', ...tramos.map((t) =>
      fmt((data.clientes ?? []).reduce((s, c) => s + (c[t] ?? 0), 0))),
      fmt((data.clientes ?? []).reduce((s, c) => s + c.total, 0))];

    tablaSimple(doc, y, ['Cliente', ...labels, 'Total'], rows, colsCart, totalsCart);
    pie(doc);
    doc.end();
  });
}

module.exports = {
  generarFacturaPDF,
  generarBalancePDF,
  generarEstadoResultadosPDF,
  generarOrdenCompraPDF,
  generarITBMSPDF,
  generarISRPDF,
  generarCSSPDF,
  generarLibroDiarioPDF,
  generarCarteraPDF,
};
