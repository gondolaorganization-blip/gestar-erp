const prisma = require('../config/prisma');

const R = (n) => Number(Number(n ?? 0).toFixed(2));

// GET /api/dashboard?desde=2026-01-01&hasta=2026-05-31
async function resumen(req, res) {
  const { empresaId } = req.usuario;
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];
  const desde = req.query.desde ? new Date(req.query.desde) : new Date(`${hoy.getFullYear()}-01-01`);
  const hasta = req.query.hasta ? new Date(req.query.hasta) : hoy;
  hasta.setHours(23, 59, 59, 999);

  try {
    // ── Marcar vencidas antes de calcular ────────────────────────────────────
    await prisma.factura.updateMany({
      where: { empresaId, estado: 'PENDIENTE', fechaVence: { lt: hoy } },
      data: { estado: 'VENCIDA' },
    });

    // ── Todas las queries en paralelo ────────────────────────────────────────
    const [
      facturasPeriodo,
      facturasEstado,
      topClientes,
      topProductos,
      facturasVencidasCount,
      facturasPorVencer,
      saldosCuentas,
      gastosPeriodo,
      tendenciaMeses,
    ] = await Promise.all([

      // 1. Totales de facturación del período
      prisma.factura.aggregate({
        where: { empresaId, fecha: { gte: desde, lte: hasta }, estado: { not: 'ANULADA' } },
        _sum: { total: true, itbms: true, subtotal: true },
        _count: { id: true },
      }),

      // 2. Conteo y monto por estado (todo el tiempo, no solo período)
      prisma.factura.groupBy({
        by: ['estado'],
        where: { empresaId },
        _count: { id: true },
        _sum: { total: true },
      }),

      // 3. Top 5 clientes por monto facturado en el período
      prisma.factura.groupBy({
        by: ['clienteId'],
        where: { empresaId, fecha: { gte: desde, lte: hasta }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),

      // 4. Top 5 productos por monto en el período
      prisma.lineaFactura.groupBy({
        by: ['productoId'],
        where: {
          productoId: { not: null },
          factura: { empresaId, fecha: { gte: desde, lte: hasta }, estado: { not: 'ANULADA' } },
        },
        _sum: { subtotal: true },
        _count: { id: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 5,
      }),

      // 5. Facturas vencidas (total pendiente)
      prisma.factura.aggregate({
        where: { empresaId, estado: 'VENCIDA' },
        _sum: { total: true },
        _count: { id: true },
      }),

      // 6. Facturas que vencen en los próximos 7 días
      prisma.factura.findMany({
        where: {
          empresaId,
          estado: 'PENDIENTE',
          fechaVence: { gte: hoy, lte: new Date(hoy.getTime() + 7 * 86400000) },
        },
        select: {
          numero: true, total: true, fechaVence: true,
          cliente: { select: { nombre: true } },
        },
        orderBy: { fechaVence: 'asc' },
      }),

      // 7. Saldos contables (banco e ITBMS por pagar) de asientos APROBADOS
      prisma.lineaAsiento.groupBy({
        by: ['cuentaId'],
        where: {
          asiento: { empresaId, estado: 'APROBADO' },
          cuenta: { codigo: { in: ['1.1.01', '1.1.02', '2.1.02'] } },
        },
        _sum: { debe: true, haber: true },
      }),

      // 8. Gastos por categoría en el período (asientos APROBADOS)
      prisma.lineaAsiento.groupBy({
        by: ['cuentaId'],
        where: {
          asiento: { empresaId, estado: 'APROBADO', fecha: { gte: desde, lte: hasta } },
          cuenta: { tipo: 'GASTO' },
        },
        _sum: { debe: true, haber: true },
      }),

      // 9. Tendencia mensual últimos 6 meses (facturación)
      prisma.$queryRaw`
        SELECT
          TO_CHAR(fecha, 'YYYY-MM') AS mes,
          SUM(total)::float         AS facturado,
          COUNT(*)::int             AS cantidad
        FROM facturas
        WHERE "empresaId" = ${empresaId}
          AND estado != 'ANULADA'
          AND fecha >= NOW() - INTERVAL '5 months'
        GROUP BY mes
        ORDER BY mes ASC
      `,
    ]);

    // ── Enriquecer top clientes con nombres ──────────────────────────────────
    const clienteIds = topClientes.map((c) => c.clienteId);
    const clientesData = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombre: true, numDoc: true },
    });
    const clienteMap = new Map(clientesData.map((c) => [c.id, c]));

    // ── Enriquecer top productos con nombres ─────────────────────────────────
    const productoIds = topProductos.map((p) => p.productoId).filter(Boolean);
    const productosData = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, codigo: true },
    });
    const productoMap = new Map(productosData.map((p) => [p.id, p]));

    // ── Enriquecer saldos contables con códigos de cuenta ───────────────────
    const cuentaIds = saldosCuentas.map((s) => s.cuentaId);
    const cuentasData = await prisma.cuentaContable.findMany({
      where: { id: { in: cuentaIds } },
      select: { id: true, codigo: true, nombre: true, tipo: true },
    });
    const cuentaMap = new Map(cuentasData.map((c) => [c.id, c]));

    // ── Enriquecer gastos con nombres de cuenta ──────────────────────────────
    const gastoCuentaIds = gastosPeriodo.map((g) => g.cuentaId);
    const gastoCuentasData = await prisma.cuentaContable.findMany({
      where: { id: { in: gastoCuentaIds } },
      select: { id: true, codigo: true, nombre: true },
    });
    const gastoCuentaMap = new Map(gastoCuentasData.map((c) => [c.id, c]));

    // ── Calcular saldo caja + banco ──────────────────────────────────────────
    let saldoCaja = 0, saldoBanco = 0, itbmsPorPagar = 0;
    for (const s of saldosCuentas) {
      const cuenta = cuentaMap.get(s.cuentaId);
      if (!cuenta) continue;
      const saldo = R(Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0));
      if (cuenta.codigo === '1.1.01') saldoCaja  = saldo;
      if (cuenta.codigo === '1.1.02') saldoBanco  = saldo;
      if (cuenta.codigo === '2.1.02') itbmsPorPagar = R(Number(s._sum.haber ?? 0) - Number(s._sum.debe ?? 0));
    }

    // ── Cobros del período (pagos registrados en facturas del período) ───────
    const cobros = await prisma.pago.aggregate({
      where: { empresaId, fecha: { gte: desde, lte: hasta } },
      _sum: { monto: true },
      _count: { id: true },
    });

    // ── Armar respuesta ──────────────────────────────────────────────────────
    const totalFacturado = R(Number(facturasPeriodo._sum.total ?? 0));
    const totalCobrado   = R(Number(cobros._sum.monto ?? 0));
    const porCobrar      = R(totalFacturado - totalCobrado);

    return res.json({
      generadoEn: new Date().toISOString(),
      periodo: {
        desde: desde.toISOString().split('T')[0],
        hasta: hasta.toISOString().split('T')[0],
      },

      // ── Facturación del período
      facturacion: {
        totalFacturado,
        totalCobrado,
        porCobrar,
        itbmsGenerado: R(Number(facturasPeriodo._sum.itbms ?? 0)),
        cantidadFacturas: facturasPeriodo._count.id,
        cantidadCobros: cobros._count.id,
      },

      // ── Situación financiera (contabilidad)
      tesoreria: {
        saldoCaja,
        saldoBanco,
        totalDisponible: R(saldoCaja + saldoBanco),
        itbmsPorPagar,
      },

      // ── Estado de la cartera
      cartera: {
        vencidas: {
          cantidad: facturasVencidasCount._count.id,
          monto: R(Number(facturasVencidasCount._sum.total ?? 0)),
        },
        porVencer: facturasPorVencer.map((f) => ({
          numero: f.numero,
          cliente: f.cliente.nombre,
          monto: R(Number(f.total)),
          fechaVence: f.fechaVence?.toISOString().split('T')[0],
          diasRestantes: Math.ceil((new Date(f.fechaVence) - hoy) / 86400000),
        })),
      },

      // ── Distribución de facturas por estado
      facturasPorEstado: facturasEstado.map((e) => ({
        estado: e.estado,
        cantidad: e._count.id,
        monto: R(Number(e._sum.total ?? 0)),
      })),

      // ── Top 5 clientes
      topClientes: topClientes.map((c) => {
        const cli = clienteMap.get(c.clienteId);
        return {
          nombre: cli?.nombre ?? 'Desconocido',
          documento: cli?.numDoc,
          totalFacturado: R(Number(c._sum.total ?? 0)),
          cantidadFacturas: c._count.id,
        };
      }),

      // ── Top 5 productos
      topProductos: topProductos.map((p) => {
        const prod = productoMap.get(p.productoId);
        return {
          codigo: prod?.codigo ?? '—',
          nombre: prod?.nombre ?? 'Desconocido',
          totalVentas: R(Number(p._sum.subtotal ?? 0)),
          cantidadVeces: p._count.id,
        };
      }),

      // ── Gastos del período por categoría
      gastosPorCategoria: gastosPeriodo
        .map((g) => {
          const cuenta = gastoCuentaMap.get(g.cuentaId);
          const monto = R(Number(g._sum.debe ?? 0) - Number(g._sum.haber ?? 0));
          return { codigo: cuenta?.codigo, nombre: cuenta?.nombre ?? '—', monto };
        })
        .filter((g) => g.monto > 0)
        .sort((a, b) => b.monto - a.monto),

      // ── Tendencia mensual (últimos 6 meses)
      tendenciaMensual: tendenciaMeses.map((m) => ({
        mes: m.mes,
        facturado: R(m.facturado),
        cantidad: Number(m.cantidad),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el dashboard' });
  }
}

module.exports = { resumen };
