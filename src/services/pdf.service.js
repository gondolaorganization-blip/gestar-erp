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

module.exports = { generarFacturaPDF, generarBalancePDF, generarEstadoResultadosPDF, generarOrdenCompraPDF };
