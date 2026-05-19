const prisma = require('../config/prisma');

const PRECISION = 2;

function redondear(n) {
  return Number(Number(n).toFixed(PRECISION));
}

async function siguienteNumero(tx, empresaId) {
  const ultimo = await tx.asiento.findFirst({
    where: { empresaId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  return (ultimo?.numero ?? 0) + 1;
}

function formatearAsiento(asiento) {
  return {
    ...asiento,
    lineas: asiento.lineas?.map((l) => ({
      ...l,
      debe: Number(l.debe),
      haber: Number(l.haber),
      cuenta: l.cuenta
        ? { id: l.cuenta.id, codigo: l.cuenta.codigo, nombre: l.cuenta.nombre }
        : undefined,
    })),
  };
}

// GET /api/asientos
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const estado = req.query.estado?.toUpperCase() || '';
  const buscar = req.query.buscar?.trim() || '';
  const desde = req.query.desde ? new Date(req.query.desde) : null;
  const hasta = req.query.hasta ? new Date(req.query.hasta) : null;

  const donde = {
    empresaId,
    ...(estado && { estado }),
    ...(buscar && {
      OR: [
        { descripcion: { contains: buscar, mode: 'insensitive' } },
        { referencia: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
    ...((desde || hasta) && {
      fecha: {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      },
    }),
  };

  try {
    const [total, asientos] = await prisma.$transaction([
      prisma.asiento.count({ where: donde }),
      prisma.asiento.findMany({
        where: donde,
        orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          lineas: {
            include: { cuenta: { select: { codigo: true, nombre: true } } },
          },
        },
      }),
    ]);

    // Calcular totales debe/haber por asiento
    const datos = asientos.map((a) => {
      const totalDebe = redondear(a.lineas.reduce((s, l) => s + Number(l.debe), 0));
      const totalHaber = redondear(a.lineas.reduce((s, l) => s + Number(l.haber), 0));
      return { ...formatearAsiento(a), totalDebe, totalHaber };
    });

    return res.json({
      datos,
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener asientos' });
  }
}

// GET /api/asientos/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const asiento = await prisma.asiento.findFirst({
      where: { id, empresaId },
      include: {
        lineas: {
          include: { cuenta: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!asiento) return res.status(404).json({ error: 'Asiento no encontrado' });

    const totalDebe = redondear(asiento.lineas.reduce((s, l) => s + Number(l.debe), 0));
    const totalHaber = redondear(asiento.lineas.reduce((s, l) => s + Number(l.haber), 0));

    return res.json({ ...formatearAsiento(asiento), totalDebe, totalHaber });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el asiento' });
  }
}

// POST /api/asientos
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { fecha, descripcion, referencia, tipo, lineas } = req.body;

  if (!fecha || !descripcion) {
    return res.status(400).json({ error: 'Fecha y descripción son requeridas' });
  }
  if (!lineas || !Array.isArray(lineas) || lineas.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 líneas en el asiento' });
  }

  // Validar líneas
  let totalDebe = 0;
  let totalHaber = 0;
  for (const [i, l] of lineas.entries()) {
    if (!l.cuentaId) {
      return res.status(400).json({ error: `Línea ${i + 1}: cuentaId es requerido` });
    }
    const debe = parseFloat(l.debe ?? 0);
    const haber = parseFloat(l.haber ?? 0);
    if (isNaN(debe) || isNaN(haber) || debe < 0 || haber < 0) {
      return res.status(400).json({ error: `Línea ${i + 1}: debe y haber deben ser >= 0` });
    }
    if (debe === 0 && haber === 0) {
      return res.status(400).json({ error: `Línea ${i + 1}: debe o haber debe ser mayor a 0` });
    }
    if (debe > 0 && haber > 0) {
      return res.status(400).json({ error: `Línea ${i + 1}: no se puede tener debe y haber simultáneamente` });
    }
    totalDebe += debe;
    totalHaber += haber;
  }

  // Regla de partida doble: debe = haber
  if (Math.abs(redondear(totalDebe) - redondear(totalHaber)) > 0.01) {
    return res.status(400).json({
      error: 'El asiento no está balanceado: el total del debe debe ser igual al total del haber',
      totalDebe: redondear(totalDebe),
      totalHaber: redondear(totalHaber),
      diferencia: redondear(Math.abs(totalDebe - totalHaber)),
    });
  }

  try {
    const asiento = await prisma.$transaction(async (tx) => {
      // Verificar cuentas
      for (const [i, l] of lineas.entries()) {
        const cuenta = await tx.cuentaContable.findFirst({
          where: { id: parseInt(l.cuentaId), empresaId },
        });
        if (!cuenta) throw new Error(`CUENTA_NO_ENCONTRADA:${i + 1}`);
        if (!cuenta.acepta) throw new Error(`CUENTA_NO_ACEPTA:${i + 1}:${cuenta.codigo}`);
      }

      const numero = await siguienteNumero(tx, empresaId);

      return await tx.asiento.create({
        data: {
          empresaId,
          numero,
          fecha: new Date(fecha),
          descripcion: descripcion.trim(),
          referencia: referencia?.trim() || null,
          tipo: tipo?.toUpperCase() === 'AUTOMATICO' ? 'AUTOMATICO' : 'MANUAL',
          estado: 'BORRADOR',
          lineas: {
            create: lineas.map((l) => ({
              cuentaId: parseInt(l.cuentaId),
              descripcion: l.descripcion?.trim() || null,
              debe: parseFloat(l.debe ?? 0),
              haber: parseFloat(l.haber ?? 0),
            })),
          },
        },
        include: {
          lineas: {
            include: { cuenta: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
          },
        },
      });
    });

    return res.status(201).json({
      ...formatearAsiento(asiento),
      totalDebe: redondear(totalDebe),
      totalHaber: redondear(totalHaber),
    });
  } catch (err) {
    if (err.message?.startsWith('CUENTA_NO_ENCONTRADA')) {
      const linea = err.message.split(':')[1];
      return res.status(404).json({ error: `Línea ${linea}: cuenta contable no encontrada` });
    }
    if (err.message?.startsWith('CUENTA_NO_ACEPTA')) {
      const [, linea, codigo] = err.message.split(':');
      return res.status(409).json({
        error: `Línea ${linea}: la cuenta ${codigo} es de agrupación y no acepta movimientos directos`,
      });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el asiento' });
  }
}

// PATCH /api/asientos/:id/aprobar
async function aprobar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const asiento = await prisma.asiento.findFirst({ where: { id, empresaId } });
    if (!asiento) return res.status(404).json({ error: 'Asiento no encontrado' });
    if (asiento.estado !== 'BORRADOR') {
      return res.status(409).json({ error: `El asiento ya está en estado ${asiento.estado}` });
    }

    const actualizado = await prisma.asiento.update({
      where: { id },
      data: { estado: 'APROBADO' },
    });

    return res.json({ mensaje: 'Asiento aprobado correctamente', estado: actualizado.estado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al aprobar el asiento' });
  }
}

// PATCH /api/asientos/:id/anular
async function anular(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const asiento = await prisma.asiento.findFirst({ where: { id, empresaId } });
    if (!asiento) return res.status(404).json({ error: 'Asiento no encontrado' });
    if (asiento.estado === 'ANULADO') {
      return res.status(409).json({ error: 'El asiento ya está anulado' });
    }

    const actualizado = await prisma.asiento.update({
      where: { id },
      data: { estado: 'ANULADO' },
    });

    return res.json({ mensaje: 'Asiento anulado correctamente', estado: actualizado.estado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al anular el asiento' });
  }
}

module.exports = { listar, obtener, crear, aprobar, anular };
