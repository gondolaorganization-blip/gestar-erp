const prisma = require('../config/prisma');

const N = (v) => Number(v ?? 0);
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ISR sociedades anónimas Panamá: 25% sobre renta neta, o 4.67% CAIR sobre renta bruta,
// lo que resulte mayor (Art. 699 y 733-A del Código Fiscal)
function calcularISRSociedad(ingresoNeto, ingresoBruto) {
  const isrNormal = Math.max(0, ingresoNeto) * 0.25;
  const cair = ingresoBruto * 0.0467;
  return { isrNormal, cair, isrFinal: Math.max(isrNormal, cair) };
}

async function obtener(req, res) {
  try {
    const { empresaId } = req.usuario;
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const inicio = new Date(`${anio}-01-01`);
    const fin    = new Date(`${anio + 1}-01-01`);

    // ── ITBMS ─────────────────────────────────────────────────────────────────
    const [facturasAnio, comprasAnio] = await Promise.all([
      prisma.factura.findMany({
        where: { empresaId, estado: { not: 'ANULADA' }, fecha: { gte: inicio, lt: fin } },
        select: { fecha: true, subtotal: true, itbms: true },
      }),
      prisma.ordenCompra.findMany({
        where: { empresaId, estado: 'RECIBIDA', fecha: { gte: inicio, lt: fin } },
        select: { fecha: true, subtotal: true, itbms: true, total: true },
      }),
    ]);

    const mesesItbms = Array.from({ length: 12 }, (_, i) => {
      const num = i + 1;
      const facs  = facturasAnio.filter(f => new Date(f.fecha).getMonth() + 1 === num);
      const comps = comprasAnio.filter(c => new Date(c.fecha).getMonth() + 1 === num);
      const ventasGravadas  = facs.reduce((s, f) => s + N(f.subtotal), 0);
      const debitoFiscal    = facs.reduce((s, f) => s + N(f.itbms), 0);
      const comprasGravadas = comps.reduce((s, c) => s + N(c.subtotal), 0);
      const creditoFiscal   = comps.reduce((s, c) => s + N(c.itbms), 0);
      return {
        mes: MESES[i],
        numero: num,
        ventasGravadas,
        debitoFiscal,
        comprasGravadas,
        creditoFiscal,
        itbmsNeto: debitoFiscal - creditoFiscal,
      };
    });

    const itbms = {
      meses: mesesItbms,
      totalDebitoFiscal:  mesesItbms.reduce((s, m) => s + m.debitoFiscal,  0),
      totalCreditoFiscal: mesesItbms.reduce((s, m) => s + m.creditoFiscal, 0),
      totalNeto:          mesesItbms.reduce((s, m) => s + m.itbmsNeto,     0),
      totalVentas:        mesesItbms.reduce((s, m) => s + m.ventasGravadas, 0),
      totalCompras:       mesesItbms.reduce((s, m) => s + m.comprasGravadas, 0),
    };

    // ── ISR ───────────────────────────────────────────────────────────────────
    const ingresosAnuales = facturasAnio.reduce((s, f) => s + N(f.subtotal), 0);

    const [periodosNomina, comprasTodas] = await Promise.all([
      prisma.periodoNomina.findMany({
        where: { empresaId, estado: { not: 'BORRADOR' }, fechaFin: { gte: inicio, lt: fin } },
        select: { totalBruto: true, totalPatrono: true },
      }),
      // comprasAnio already fetched above; reuse
      Promise.resolve(comprasAnio),
    ]);

    const egresosCompras = comprasAnio.reduce((s, c) => s + N(c.total), 0);
    const egresosNomina  = periodosNomina.reduce(
      (s, p) => s + N(p.totalBruto) + N(p.totalPatrono), 0
    );
    const egresosAnuales = egresosCompras + egresosNomina;
    const utilidadNeta   = ingresosAnuales - egresosAnuales;

    const { isrNormal, cair, isrFinal } = calcularISRSociedad(utilidadNeta, ingresosAnuales);

    const isr = {
      ingresosAnuales,
      egresosAnuales,
      egresosCompras,
      egresosNomina,
      utilidadNeta,
      isrNormal,
      cair,
      isrFinal,
      aplicaCair: cair > isrNormal,
      tasaEfectiva: ingresosAnuales > 0 ? (isrFinal / ingresosAnuales) * 100 : 0,
    };

    // ── CSS / SEA (desde nómina) ───────────────────────────────────────────────
    const lineasAnio = await prisma.lineaNomina.findMany({
      where: {
        empresaId,
        periodo: { estado: { not: 'BORRADOR' }, fechaFin: { gte: inicio, lt: fin } },
      },
      select: { cssEmpleado: true, seaEmpleado: true, isr: true, cssPatrono: true, seaPatrono: true },
    });

    const css = {
      totalCSSEmpleado: lineasAnio.reduce((s, l) => s + N(l.cssEmpleado), 0),
      totalSEAEmpleado: lineasAnio.reduce((s, l) => s + N(l.seaEmpleado), 0),
      totalISRNomina:   lineasAnio.reduce((s, l) => s + N(l.isr),          0),
      totalCSSPatrono:  lineasAnio.reduce((s, l) => s + N(l.cssPatrono),   0),
      totalSEAPatrono:  lineasAnio.reduce((s, l) => s + N(l.seaPatrono),   0),
      totalEmpleado:    lineasAnio.reduce((s, l) => s + N(l.cssEmpleado) + N(l.seaEmpleado), 0),
      totalPatrono:     lineasAnio.reduce((s, l) => s + N(l.cssPatrono)  + N(l.seaPatrono),  0),
    };

    return res.json({ anio, itbms, isr, css });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener datos de impuestos' });
  }
}

module.exports = { obtener };
