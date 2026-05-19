const prisma = require('../config/prisma');
const { asientoNominaPagada } = require('../services/contabilidad.service');

// ─── Tasas CSS / SEA Panamá ───────────────────────────────────────────────────
const CSS_EMPLEADO = 0.0975;   // 9.75%
const SEA_EMPLEADO = 0.0125;   // 1.25%
const CSS_PATRONO  = 0.1225;   // 12.25%
const SEA_PATRONO  = 0.015;    // 1.50%

// ─── ISR Panamá — tramos anuales ─────────────────────────────────────────────
function calcularISRAnual(salarioBrutoAnual) {
  if (salarioBrutoAnual <= 11000) return 0;
  if (salarioBrutoAnual <= 100000) return (salarioBrutoAnual - 11000) * 0.15;
  return (100000 - 11000) * 0.15 + (salarioBrutoAnual - 100000) * 0.25;
}

function calcularLinea(salarioMensual, periodoPago) {
  const divisor      = periodoPago === 'QUINCENAL' ? 2 : 1;
  const salarioBruto = R(salarioMensual / divisor);
  const cssEmp       = R(salarioBruto * CSS_EMPLEADO);
  const seaEmp       = R(salarioBruto * SEA_EMPLEADO);

  // ISR mensual → distribuido según período
  const isrAnual     = calcularISRAnual(salarioMensual * 12);
  const isrPeriodo   = R(isrAnual / 12 / divisor);

  const totalDeduccion = R(cssEmp + seaEmp + isrPeriodo);
  const salarioNeto    = R(salarioBruto - totalDeduccion);
  const cssPatrono     = R(salarioBruto * CSS_PATRONO);
  const seaPatrono     = R(salarioBruto * SEA_PATRONO);

  return { salarioBruto, cssEmp, seaEmp, isrPeriodo, totalDeduccion, salarioNeto, cssPatrono, seaPatrono };
}

const R = (n) => Math.round(Number(n) * 100) / 100;

// GET /api/nomina
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(50, Math.max(1, parseInt(req.query.limite) || 10));
  const tipo   = req.query.tipo?.toUpperCase() || '';

  const donde = {
    empresaId,
    ...(tipo && { tipo }),
  };

  try {
    const [total, periodos] = await prisma.$transaction([
      prisma.periodoNomina.count({ where: donde }),
      prisma.periodoNomina.findMany({
        where: donde,
        orderBy: { fechaInicio: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { _count: { select: { lineas: true } } },
      }),
    ]);

    return res.json({
      datos: periodos.map(formatearPeriodo),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener períodos de nómina' });
  }
}

// GET /api/nomina/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const periodo = await prisma.periodoNomina.findFirst({
      where: { id, empresaId },
      include: {
        lineas: {
          include: { empleado: { select: { id: true, nombre: true, apellido: true, cedula: true, cargo: true, departamento: true } } },
          orderBy: { empleado: { apellido: 'asc' } },
        },
      },
    });

    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

    return res.json({
      ...formatearPeriodo(periodo),
      lineas: periodo.lineas.map(formatearLinea),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener período' });
  }
}

// POST /api/nomina  — crear y calcular período para todos los empleados activos
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { tipo, fechaInicio, fechaFin, fechaPago, notas } = req.body;

  if (!fechaInicio || !fechaFin || !fechaPago) {
    return res.status(400).json({ error: 'Fechas de inicio, fin y pago son requeridas' });
  }

  const tipoNorm = tipo ? tipo.toUpperCase() : 'REGULAR';
  if (!['REGULAR', 'DECIMO'].includes(tipoNorm)) {
    return res.status(400).json({ error: 'Tipo debe ser REGULAR o DECIMO' });
  }

  try {
    const empleados = await prisma.empleado.findMany({
      where: { empresaId, activo: true },
    });

    if (empleados.length === 0) {
      return res.status(400).json({ error: 'No hay empleados activos para generar nómina' });
    }

    // Número correlativo
    const ultimo = await prisma.periodoNomina.findFirst({
      where: { empresaId }, orderBy: { id: 'desc' }, select: { numero: true },
    });
    const n = ultimo ? parseInt(ultimo.numero.split('-').pop() || '0') + 1 : 1;
    const numero = `NOM-${String(n).padStart(4, '0')}`;

    // Calcular líneas
    const lineasData = [];
    let totalBruto = 0, totalDeduccion = 0, totalPatrono = 0, totalNeto = 0;

    for (const emp of empleados) {
      const salMensual = Number(emp.salarioMensual);

      let salarioBruto, cssEmp, seaEmp, isrPeriodo, totalDesc, salNeto, cssPatr, seaPatr;

      if (tipoNorm === 'DECIMO') {
        // Décimo tercer mes: 1 salario mensual dividido en 3 pagos anuales
        // CSS y SEA sí aplican; ISR exento por ley panameña
        salarioBruto = R(salMensual / 3);
        cssEmp = R(salarioBruto * CSS_EMPLEADO);
        seaEmp = R(salarioBruto * SEA_EMPLEADO);
        isrPeriodo = 0;
        totalDesc = R(cssEmp + seaEmp);
        salNeto = R(salarioBruto - totalDesc);
        cssPatr = R(salarioBruto * CSS_PATRONO);
        seaPatr = R(salarioBruto * SEA_PATRONO);
      } else {
        const calc = calcularLinea(salMensual, emp.periodoPago);
        salarioBruto = calc.salarioBruto;
        cssEmp       = calc.cssEmp;
        seaEmp       = calc.seaEmp;
        isrPeriodo   = calc.isrPeriodo;
        totalDesc    = calc.totalDeduccion;
        salNeto      = calc.salarioNeto;
        cssPatr      = calc.cssPatrono;
        seaPatr      = calc.seaPatrono;
      }

      totalBruto    += salarioBruto;
      totalDeduccion += totalDesc;
      totalPatrono  += cssPatr + seaPatr;
      totalNeto     += salNeto;

      lineasData.push({
        empleadoId: emp.id,
        empresaId,
        salarioBruto,
        cssEmpleado: cssEmp,
        seaEmpleado: seaEmp,
        isr: isrPeriodo,
        otrosDescuentos: 0,
        totalDeduccion: totalDesc,
        salarioNeto: salNeto,
        cssPatrono: cssPatr,
        seaPatrono: seaPatr,
      });
    }

    const periodo = await prisma.periodoNomina.create({
      data: {
        empresaId,
        numero,
        tipo: tipoNorm,
        fechaInicio: new Date(fechaInicio),
        fechaFin:    new Date(fechaFin),
        fechaPago:   new Date(fechaPago),
        totalBruto:    R(totalBruto),
        totalDeduccion: R(totalDeduccion),
        totalPatrono:  R(totalPatrono),
        totalNeto:     R(totalNeto),
        notas: notas?.trim() || null,
        lineas: { create: lineasData },
      },
      include: {
        lineas: {
          include: { empleado: { select: { id: true, nombre: true, apellido: true, cedula: true, cargo: true, departamento: true } } },
        },
      },
    });

    return res.status(201).json({
      ...formatearPeriodo(periodo),
      lineas: periodo.lineas.map(formatearLinea),
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un período con ese número' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear período de nómina' });
  }
}

// PATCH /api/nomina/:id/estado
async function cambiarEstado(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { estado } = req.body;
  const ESTADOS = ['BORRADOR', 'APROBADO', 'PAGADO'];
  if (!estado || !ESTADOS.includes(estado.toUpperCase())) {
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });
  }

  try {
    const periodo = await prisma.periodoNomina.findFirst({ where: { id, empresaId } });
    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

    const nuevoEstado = estado.toUpperCase();
    const actualizado = await prisma.periodoNomina.update({ where: { id }, data: { estado: nuevoEstado } });

    if (nuevoEstado === 'PAGADO') {
      asientoNominaPagada(prisma, actualizado, empresaId).catch(() => {});
    }

    return res.json(formatearPeriodo(actualizado));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar estado' });
  }
}

// PATCH /api/nomina/:periodoId/lineas/:lineaId
async function actualizarLinea(req, res) {
  const { empresaId } = req.usuario;
  const periodoId = parseInt(req.params.periodoId);
  const lineaId   = parseInt(req.params.lineaId);
  if (isNaN(periodoId) || isNaN(lineaId)) return res.status(400).json({ error: 'IDs inválidos' });

  const { otrosIngresos, otrosDescuentos, notas } = req.body;

  try {
    const linea = await prisma.lineaNomina.findFirst({ where: { id: lineaId, periodoId, empresaId } });
    if (!linea) return res.status(404).json({ error: 'Línea no encontrada' });

    const nuevosIngresos  = otrosIngresos  !== undefined ? R(Math.max(0, parseFloat(otrosIngresos)  || 0)) : Number(linea.otrosIngresos);
    const nuevosDescuentos = otrosDescuentos !== undefined ? R(Math.max(0, parseFloat(otrosDescuentos) || 0)) : Number(linea.otrosDescuentos);
    const nuevoTotal  = R(Number(linea.cssEmpleado) + Number(linea.seaEmpleado) + Number(linea.isr) + nuevosDescuentos);
    const nuevoNeto   = R(Number(linea.salarioBruto) + nuevosIngresos - nuevoTotal);

    const actualizada = await prisma.lineaNomina.update({
      where: { id: lineaId },
      data: {
        otrosIngresos:   nuevosIngresos,
        otrosDescuentos: nuevosDescuentos,
        totalDeduccion:  nuevoTotal,
        salarioNeto:     nuevoNeto,
        ...(notas !== undefined && { notas: notas?.trim() || null }),
      },
      include: { empleado: { select: { id: true, nombre: true, apellido: true, cedula: true, cargo: true, departamento: true } } },
    });

    // Recalcular totales del período
    const lineas = await prisma.lineaNomina.findMany({ where: { periodoId, empresaId } });
    const tb = lineas.reduce((s, l) => s + Number(l.salarioBruto) + Number(l.otrosIngresos), 0);
    const td = lineas.reduce((s, l) => s + Number(l.totalDeduccion), 0);
    const tp = lineas.reduce((s, l) => s + Number(l.cssPatrono) + Number(l.seaPatrono), 0);
    const tn = lineas.reduce((s, l) => s + Number(l.salarioNeto), 0);

    await prisma.periodoNomina.update({
      where: { id: periodoId },
      data: { totalBruto: R(tb), totalDeduccion: R(td), totalPatrono: R(tp), totalNeto: R(tn) },
    });

    return res.json(formatearLinea(actualizada));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar línea' });
  }
}

// POST /api/nomina/:id/comprobantes — envía comprobante de pago a cada empleado con email
async function enviarComprobantes(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const [periodo, empresa] = await Promise.all([
      prisma.periodoNomina.findFirst({
        where: { id, empresaId },
        include: {
          lineas: {
            include: { empleado: { select: { id: true, nombre: true, apellido: true, cedula: true, cargo: true, email: true } } },
          },
        },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId } }),
    ]);

    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

    const { enviarComprobanteNomina } = require('../services/email.service');
    let enviados = 0, sinEmail = 0;

    for (const linea of periodo.lineas) {
      if (!linea.empleado?.email) { sinEmail++; continue; }
      await enviarComprobanteNomina({
        empleadoEmail:  linea.empleado.email,
        empleadoNombre: `${linea.empleado.nombre} ${linea.empleado.apellido ?? ''}`.trim(),
        empresaNombre:  empresa?.nombre ?? '',
        periodo: {
          numero:     periodo.numero,
          tipo:       periodo.tipo,
          fechaInicio: periodo.fechaInicio,
          fechaFin:    periodo.fechaFin,
          fechaPago:   periodo.fechaPago,
        },
        linea: {
          salarioBruto:    Number(linea.salarioBruto),
          otrosIngresos:   Number(linea.otrosIngresos),
          cssEmpleado:     Number(linea.cssEmpleado),
          seaEmpleado:     Number(linea.seaEmpleado),
          isr:             Number(linea.isr),
          otrosDescuentos: Number(linea.otrosDescuentos),
          totalDeduccion:  Number(linea.totalDeduccion),
          salarioNeto:     Number(linea.salarioNeto),
          notas:           linea.notas,
        },
      }).catch(() => {});
      enviados++;
    }

    return res.json({ mensaje: `Comprobantes enviados: ${enviados}. Sin email: ${sinEmail}.`, enviados, sinEmail });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al enviar comprobantes' });
  }
}

// GET /api/nomina/preview  — calcula sin guardar para un empleado
async function preview(req, res) {
  const { empresaId } = req.usuario;
  const empleadoId = parseInt(req.query.empleadoId);
  if (isNaN(empleadoId)) return res.status(400).json({ error: 'empleadoId requerido' });

  try {
    const emp = await prisma.empleado.findFirst({ where: { id: empleadoId, empresaId, activo: true } });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    const salMensual = Number(emp.salarioMensual);
    const calc = calcularLinea(salMensual, emp.periodoPago);

    return res.json({
      empleado: { id: emp.id, nombre: emp.nombre, apellido: emp.apellido, cargo: emp.cargo },
      periodoPago:  emp.periodoPago,
      salarioMensual: salMensual,
      ...calc,
      tasas: {
        cssEmpleado: `${(CSS_EMPLEADO * 100).toFixed(2)}%`,
        seaEmpleado: `${(SEA_EMPLEADO * 100).toFixed(2)}%`,
        cssPatrono:  `${(CSS_PATRONO  * 100).toFixed(2)}%`,
        seaPatrono:  `${(SEA_PATRONO  * 100).toFixed(2)}%`,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al calcular preview' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatearPeriodo(p) {
  return {
    ...p,
    totalBruto:     R(p.totalBruto),
    totalDeduccion: R(p.totalDeduccion),
    totalPatrono:   R(p.totalPatrono),
    totalNeto:      R(p.totalNeto),
    cantidadEmpleados: p._count?.lineas ?? p.lineas?.length ?? 0,
    _count: undefined,
  };
}

function formatearLinea(l) {
  return {
    ...l,
    salarioBruto:    R(l.salarioBruto),
    otrosIngresos:   R(l.otrosIngresos),
    cssEmpleado:     R(l.cssEmpleado),
    seaEmpleado:     R(l.seaEmpleado),
    isr:             R(l.isr),
    otrosDescuentos: R(l.otrosDescuentos),
    totalDeduccion:  R(l.totalDeduccion),
    salarioNeto:     R(l.salarioNeto),
    cssPatrono:      R(l.cssPatrono),
    seaPatrono:      R(l.seaPatrono),
  };
}

module.exports = { listar, obtener, crear, cambiarEstado, actualizarLinea, enviarComprobantes, preview };
