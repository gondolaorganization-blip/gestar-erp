const prisma = require('../config/prisma');

const R = (n) => Number(Number(n).toFixed(2));

// El saldo normal de una cuenta determina cómo se calcula su balance:
// ACTIVO y GASTO: saldo deudor  → balance = debe - haber
// PASIVO, PATRIMONIO e INGRESO: saldo acreedor → balance = haber - debe
function calcularSaldo(tipo, debe, haber) {
  return ['ACTIVO', 'GASTO'].includes(tipo) ? R(debe - haber) : R(haber - debe);
}

// Obtener saldos de todas las cuentas de la empresa hasta una fecha dada,
// considerando solo asientos APROBADOS
async function obtenerSaldosCuentas(empresaId, hasta, desde = null) {
  const donde = {
    asiento: {
      empresaId,
      estado: 'APROBADO',
      fecha: {
        ...(hasta && { lte: new Date(hasta) }),
        ...(desde && { gte: new Date(desde) }),
      },
    },
  };

  const lineas = await prisma.lineaAsiento.groupBy({
    by: ['cuentaId'],
    where: donde,
    _sum: { debe: true, haber: true },
  });

  const cuentas = await prisma.cuentaContable.findMany({
    where: { empresaId, acepta: true },
    select: { id: true, codigo: true, nombre: true, tipo: true, padre: true, nivel: true },
  });

  const mapa = new Map(cuentas.map((c) => [c.id, { ...c, debe: 0, haber: 0 }]));

  for (const l of lineas) {
    const c = mapa.get(l.cuentaId);
    if (c) {
      c.debe = R(Number(l._sum.debe ?? 0));
      c.haber = R(Number(l._sum.haber ?? 0));
    }
  }

  return Array.from(mapa.values()).map((c) => ({
    ...c,
    saldo: calcularSaldo(c.tipo, c.debe, c.haber),
  }));
}

// ─── BALANCE GENERAL ─────────────────────────────────────────────────────────
// GET /api/reportes/balance-general?al=2026-05-31

async function balanceGeneral(req, res) {
  const { empresaId } = req.usuario;
  const al = req.query.al || new Date().toISOString().split('T')[0];

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nombre: true, ruc: true },
    });

    const cuentas = await obtenerSaldosCuentas(empresaId, al);

    const agrupar = (tipo) =>
      cuentas
        .filter((c) => c.tipo === tipo && c.saldo !== 0)
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((c) => ({ codigo: c.codigo, nombre: c.nombre, saldo: c.saldo }));

    const activos     = agrupar('ACTIVO');
    const pasivos     = agrupar('PASIVO');
    const patrimonio  = agrupar('PATRIMONIO');

    // Calcular utilidad del ejercicio (ingresos - gastos) hasta la fecha
    // para incluirla en el patrimonio sin necesidad de asiento de cierre
    const ingresos = cuentas.filter((c) => c.tipo === 'INGRESO');
    const gastos   = cuentas.filter((c) => c.tipo === 'GASTO');
    const totalIngresos = R(ingresos.reduce((s, c) => s + c.saldo, 0));
    const totalGastos   = R(gastos.reduce((s, c)   => s + c.saldo, 0));
    const utilidadEjercicio = R(totalIngresos - totalGastos);

    const totalActivos    = R(activos.reduce((s, c) => s + c.saldo, 0));
    const totalPasivos    = R(pasivos.reduce((s, c) => s + c.saldo, 0));
    const totalPatrimonio = R(patrimonio.reduce((s, c) => s + c.saldo, 0) + utilidadEjercicio);
    const totalPasivoPatrimonio = R(totalPasivos + totalPatrimonio);
    const cuadra = Math.abs(totalActivos - totalPasivoPatrimonio) <= 0.02;

    return res.json({
      reporte: 'Balance General',
      empresa: empresa.nombre,
      ruc: empresa.ruc,
      al,
      activos:    { cuentas: activos,    total: totalActivos },
      pasivos:    { cuentas: pasivos,    total: totalPasivos },
      patrimonio: {
        cuentas: patrimonio,
        utilidadEjercicio,
        resultadoEjercicio: utilidadEjercicio >= 0 ? 'UTILIDAD' : 'PÉRDIDA',
        total: totalPatrimonio,
      },
      totalPasivoPatrimonio,
      ecuacionCuadra: cuadra,
      nota: cuadra ? null : 'Diferencia detectada — verifique que todos los asientos estén balanceados',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Balance General' });
  }
}

// ─── ESTADO DE RESULTADOS ────────────────────────────────────────────────────
// GET /api/reportes/estado-resultados?desde=2026-01-01&hasta=2026-05-31

async function estadoResultados(req, res) {
  const { empresaId } = req.usuario;
  const hoy = new Date().toISOString().split('T')[0];
  const desde = req.query.desde || `${new Date().getFullYear()}-01-01`;
  const hasta = req.query.hasta || hoy;

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nombre: true, ruc: true },
    });

    const cuentas = await obtenerSaldosCuentas(empresaId, hasta, desde);

    const agrupar = (tipo) =>
      cuentas
        .filter((c) => c.tipo === tipo && c.saldo !== 0)
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((c) => ({ codigo: c.codigo, nombre: c.nombre, saldo: c.saldo }));

    const ingresos = agrupar('INGRESO');
    const gastos   = agrupar('GASTO');

    const totalIngresos = R(ingresos.reduce((s, c) => s + c.saldo, 0));
    const totalGastos   = R(gastos.reduce((s, c) => s + c.saldo, 0));
    const utilidadNeta  = R(totalIngresos - totalGastos);

    return res.json({
      reporte: 'Estado de Resultados',
      empresa: empresa.nombre,
      ruc: empresa.ruc,
      periodo: { desde, hasta },
      ingresos: { cuentas: ingresos, total: totalIngresos },
      gastos:   { cuentas: gastos,   total: totalGastos },
      utilidadNeta,
      resultado: utilidadNeta >= 0 ? 'UTILIDAD' : 'PÉRDIDA',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Estado de Resultados' });
  }
}

// ─── LIBRO DIARIO ────────────────────────────────────────────────────────────
// GET /api/reportes/libro-diario?desde=2026-01-01&hasta=2026-05-31&estado=APROBADO

async function libroDiario(req, res) {
  const { empresaId } = req.usuario;
  const hoy = new Date().toISOString().split('T')[0];
  const desde = req.query.desde || `${new Date().getFullYear()}-01-01`;
  const hasta = req.query.hasta || hoy;
  const estado = req.query.estado?.toUpperCase() || '';
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 50));

  const donde = {
    empresaId,
    fecha: { gte: new Date(desde), lte: new Date(hasta) },
    ...(estado && { estado }),
  };

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nombre: true, ruc: true },
    });

    const [total, asientos] = await prisma.$transaction([
      prisma.asiento.count({ where: donde }),
      prisma.asiento.findMany({
        where: donde,
        orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          lineas: {
            include: { cuenta: { select: { codigo: true, nombre: true } } },
            orderBy: { id: 'asc' },
          },
        },
      }),
    ]);

    const datos = asientos.map((a) => {
      const totalDebe  = R(a.lineas.reduce((s, l) => s + Number(l.debe), 0));
      const totalHaber = R(a.lineas.reduce((s, l) => s + Number(l.haber), 0));
      return {
        numero: a.numero,
        fecha: a.fecha,
        descripcion: a.descripcion,
        referencia: a.referencia,
        estado: a.estado,
        tipo: a.tipo,
        lineas: a.lineas.map((l) => ({
          cuenta: `${l.cuenta.codigo} — ${l.cuenta.nombre}`,
          descripcion: l.descripcion,
          debe:  R(Number(l.debe)),
          haber: R(Number(l.haber)),
        })),
        totalDebe,
        totalHaber,
      };
    });

    const grandTotalDebe  = R(datos.reduce((s, a) => s + a.totalDebe, 0));
    const grandTotalHaber = R(datos.reduce((s, a) => s + a.totalHaber, 0));

    return res.json({
      reporte: 'Libro Diario',
      empresa: empresa.nombre,
      ruc: empresa.ruc,
      periodo: { desde, hasta },
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
      asientos: datos,
      totales: { debe: grandTotalDebe, haber: grandTotalHaber },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Libro Diario' });
  }
}

// ─── ANTIGÜEDAD DE CARTERA (Cuentas por Cobrar) ──────────────────────────────
// GET /api/reportes/antiguedad-cartera?al=2026-05-31

async function antiguedadCartera(req, res) {
  const { empresaId } = req.usuario;
  const al = req.query.al ? new Date(req.query.al) : new Date();
  const alStr = al.toISOString().split('T')[0];

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nombre: true, ruc: true },
    });

    // Facturas pendientes y vencidas con sus pagos
    const facturas = await prisma.factura.findMany({
      where: {
        empresaId,
        estado: { in: ['PENDIENTE', 'VENCIDA'] },
        fecha: { lte: al },
      },
      include: {
        cliente: { select: { id: true, nombre: true, numDoc: true } },
        pagos: { select: { monto: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    const hoy = al;

    const porCliente = new Map();

    for (const f of facturas) {
      const totalPagado = f.pagos.reduce((s, p) => s + Number(p.monto), 0);
      const saldo = R(Number(f.total) - totalPagado);
      if (saldo <= 0) continue;

      const diasVencida = f.fechaVence
        ? Math.floor((hoy - new Date(f.fechaVence)) / 86400000)
        : Math.floor((hoy - new Date(f.fecha)) / 86400000);

      const bucket =
        diasVencida <= 0  ? 'corriente'  :
        diasVencida <= 30 ? 'vencida_30' :
        diasVencida <= 60 ? 'vencida_60' :
        diasVencida <= 90 ? 'vencida_90' : 'vencida_mas90';

      const cid = f.cliente.id;
      if (!porCliente.has(cid)) {
        porCliente.set(cid, {
          cliente: f.cliente.nombre,
          documento: f.cliente.numDoc,
          corriente: 0, vencida_30: 0, vencida_60: 0,
          vencida_90: 0, vencida_mas90: 0, total: 0,
          facturas: [],
        });
      }

      const entry = porCliente.get(cid);
      entry[bucket] = R(entry[bucket] + saldo);
      entry.total   = R(entry.total + saldo);
      entry.facturas.push({
        numero: f.numero,
        fecha: f.fecha,
        fechaVence: f.fechaVence,
        saldo,
        diasVencida: Math.max(0, diasVencida),
        bucket,
      });
    }

    const clientes = Array.from(porCliente.values());
    const totales = {
      corriente:    R(clientes.reduce((s, c) => s + c.corriente, 0)),
      vencida_30:   R(clientes.reduce((s, c) => s + c.vencida_30, 0)),
      vencida_60:   R(clientes.reduce((s, c) => s + c.vencida_60, 0)),
      vencida_90:   R(clientes.reduce((s, c) => s + c.vencida_90, 0)),
      vencida_mas90:R(clientes.reduce((s, c) => s + c.vencida_mas90, 0)),
      total:        R(clientes.reduce((s, c) => s + c.total, 0)),
    };

    return res.json({
      reporte: 'Antigüedad de Cartera',
      empresa: empresa.nombre,
      ruc: empresa.ruc,
      al: alStr,
      columnas: ['Corriente', '1-30 días', '31-60 días', '61-90 días', '+90 días', 'Total'],
      clientes,
      totales,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el reporte de antigüedad' });
  }
}

module.exports = { balanceGeneral, estadoResultados, libroDiario, antiguedadCartera };
