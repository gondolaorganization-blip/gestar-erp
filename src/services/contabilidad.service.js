const R = (n) => Number(Number(n ?? 0).toFixed(2));

const COD = {
  CAJA:          '1.1.01',
  CXC:           '1.1.03',
  ITBMS_COBRAR:  '1.1.04',
  INVENTARIO:    '1.1.05',
  CXP:           '2.1.01',
  ITBMS_PAGAR:   '2.1.02',
  CSS_PAGAR:     '2.1.05',
  VENTAS:        '4.1.01',
  SUELDOS_GASTO: '5.2.01',
  CSS_PATRONO:   '5.2.02',
};

async function cuentas(tx, empresaId, codigos) {
  const rows = await tx.cuentaContable.findMany({
    where: { empresaId, codigo: { in: codigos } },
    select: { id: true, codigo: true },
  });
  const m = {};
  for (const r of rows) m[r.codigo] = r.id;
  return m;
}

async function nextNumero(tx, empresaId) {
  const ultimo = await tx.asiento.findFirst({
    where: { empresaId }, orderBy: { numero: 'desc' }, select: { numero: true },
  });
  return (ultimo?.numero ?? 0) + 1;
}

async function crear(tx, { empresaId, fecha, descripcion, referencia, lineas }) {
  const numero = await nextNumero(tx, empresaId);
  return tx.asiento.create({
    data: {
      empresaId, numero,
      fecha: new Date(fecha),
      descripcion, referencia: referencia ?? null,
      tipo: 'AUTOMATICO', estado: 'APROBADO',
      lineas: {
        create: lineas.map(({ cuentaId, descripcion: d, debe, haber }) => ({
          cuentaId, descripcion: d ?? null, debe: debe ?? 0, haber: haber ?? 0,
        })),
      },
    },
  });
}

// ── Factura emitida → Debe CxC / Haber Ventas + ITBMS por Pagar ──────────────
async function asientoFacturaCreada(tx, factura, empresaId) {
  try {
    const subtotal = R(Number(factura.subtotal));
    const itbms    = R(Number(factura.itbms));
    const total    = R(Number(factura.total));
    if (total <= 0) return;

    const c = await cuentas(tx, empresaId, [COD.CXC, COD.VENTAS, COD.ITBMS_PAGAR]);
    if (!c[COD.CXC] || !c[COD.VENTAS]) return;

    const lineas = [
      { cuentaId: c[COD.CXC],    debe: total,    haber: 0,        descripcion: `CxC ${factura.numero}` },
      { cuentaId: c[COD.VENTAS], debe: 0,         haber: subtotal, descripcion: `Venta ${factura.numero}` },
    ];
    if (itbms > 0 && c[COD.ITBMS_PAGAR]) {
      lineas.push({ cuentaId: c[COD.ITBMS_PAGAR], debe: 0, haber: itbms, descripcion: `ITBMS ${factura.numero}` });
    }

    await crear(tx, { empresaId, fecha: factura.fecha, descripcion: `Venta — ${factura.numero}`, referencia: factura.numero, lineas });
  } catch (e) { console.error('[asientoFacturaCreada]', e.message); }
}

// ── Cobro recibido → Debe Caja / Haber CxC ───────────────────────────────────
async function asientoCobroFactura(tx, { monto, fecha, facturaNumero }, empresaId) {
  try {
    const montoN = R(Number(monto));
    if (montoN <= 0) return;

    const c = await cuentas(tx, empresaId, [COD.CAJA, COD.CXC]);
    if (!c[COD.CAJA] || !c[COD.CXC]) return;

    await crear(tx, {
      empresaId, fecha,
      descripcion: `Cobro — ${facturaNumero}`,
      referencia:  facturaNumero,
      lineas: [
        { cuentaId: c[COD.CAJA], debe: montoN, haber: 0,      descripcion: `Cobro ${facturaNumero}` },
        { cuentaId: c[COD.CXC],  debe: 0,      haber: montoN, descripcion: `Cobro ${facturaNumero}` },
      ],
    });
  } catch { /* omitir */ }
}

// ── OC recibida → Debe Inventario + ITBMS por Cobrar / Haber CxP ─────────────
async function asientoOCRecibida(tx, orden, empresaId) {
  try {
    const subtotal = R(Number(orden.subtotal));
    const itbms    = R(Number(orden.itbms));
    const total    = R(Number(orden.total));
    if (total <= 0) return;

    const c = await cuentas(tx, empresaId, [COD.INVENTARIO, COD.ITBMS_COBRAR, COD.CXP]);
    if (!c[COD.INVENTARIO] || !c[COD.CXP]) return;

    const lineas = [
      { cuentaId: c[COD.INVENTARIO], debe: subtotal, haber: 0,     descripcion: `Compra ${orden.numero}` },
    ];
    if (itbms > 0 && c[COD.ITBMS_COBRAR]) {
      lineas.push({ cuentaId: c[COD.ITBMS_COBRAR], debe: itbms, haber: 0, descripcion: `ITBMS compra ${orden.numero}` });
    }
    lineas.push({ cuentaId: c[COD.CXP], debe: 0, haber: total, descripcion: `CxP ${orden.numero}` });

    await crear(tx, { empresaId, fecha: orden.fecha, descripcion: `Compra — ${orden.numero}`, referencia: orden.numero, lineas });
  } catch { /* omitir */ }
}

// ── Pago a proveedor → Debe CxP / Haber Caja ─────────────────────────────────
async function asientoPagoProveedor(tx, { monto, fecha, ordenNumero }, empresaId) {
  try {
    const montoN = R(Number(monto));
    if (montoN <= 0) return;

    const c = await cuentas(tx, empresaId, [COD.CXP, COD.CAJA]);
    if (!c[COD.CXP] || !c[COD.CAJA]) return;

    await crear(tx, {
      empresaId, fecha,
      descripcion: `Pago proveedor — ${ordenNumero}`,
      referencia:  ordenNumero,
      lineas: [
        { cuentaId: c[COD.CXP],  debe: montoN, haber: 0,      descripcion: `Pago ${ordenNumero}` },
        { cuentaId: c[COD.CAJA], debe: 0,      haber: montoN, descripcion: `Pago ${ordenNumero}` },
      ],
    });
  } catch { /* omitir */ }
}

// ── Nómina pagada → Debe Sueldos + CSS Patrono / Haber CSS por Pagar + Caja ──
async function asientoNominaPagada(tx, periodo, empresaId) {
  try {
    const totalBruto    = R(Number(periodo.totalBruto));
    const totalPatrono  = R(Number(periodo.totalPatrono));
    const totalNeto     = R(Number(periodo.totalNeto));
    const totalDeduccion = R(Number(periodo.totalDeduccion));
    const cssPagar      = R(totalDeduccion + totalPatrono);
    if (totalBruto <= 0) return;

    const c = await cuentas(tx, empresaId, [COD.SUELDOS_GASTO, COD.CSS_PATRONO, COD.CSS_PAGAR, COD.CAJA]);
    if (!c[COD.SUELDOS_GASTO] || !c[COD.CAJA]) return;

    const lineas = [
      { cuentaId: c[COD.SUELDOS_GASTO], debe: totalBruto,  haber: 0, descripcion: `Sueldos ${periodo.numero}` },
    ];
    if (totalPatrono > 0 && c[COD.CSS_PATRONO]) {
      lineas.push({ cuentaId: c[COD.CSS_PATRONO], debe: totalPatrono, haber: 0, descripcion: `CSS patrono ${periodo.numero}` });
    }
    if (cssPagar > 0 && c[COD.CSS_PAGAR]) {
      lineas.push({ cuentaId: c[COD.CSS_PAGAR], debe: 0, haber: cssPagar, descripcion: `CSS por pagar ${periodo.numero}` });
    }
    lineas.push({ cuentaId: c[COD.CAJA], debe: 0, haber: totalNeto, descripcion: `Neto pagado ${periodo.numero}` });

    await crear(tx, {
      empresaId, fecha: periodo.fechaPago,
      descripcion: `Nómina — ${periodo.numero}`,
      referencia:  periodo.numero,
      lineas,
    });
  } catch { /* omitir */ }
}

module.exports = { asientoFacturaCreada, asientoCobroFactura, asientoOCRecibida, asientoPagoProveedor, asientoNominaPagada };
