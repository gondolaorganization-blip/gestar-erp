const prisma = require('../config/prisma');

const ETAPAS = ['PROSPECTO', 'CALIFICACION', 'PROPUESTA', 'NEGOCIACION', 'CERRADO_GANADO', 'CERRADO_PERDIDO'];

const PROB_DEFAULT = {
  PROSPECTO:       10,
  CALIFICACION:    25,
  PROPUESTA:       50,
  NEGOCIACION:     75,
  CERRADO_GANADO:  100,
  CERRADO_PERDIDO: 0,
};

const R = (n) => Math.round(Number(n) * 100) / 100;

// GET /api/oportunidades  — lista + pipeline (agrupado por etapa)
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const vista   = req.query.vista || 'lista';    // lista | kanban
  const buscar  = req.query.buscar?.trim() || '';
  const etapa   = req.query.etapa?.toUpperCase() || '';
  const pagina  = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite  = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));

  const donde = {
    empresaId,
    ...(etapa && ETAPAS.includes(etapa) && { etapa }),
    ...(buscar && {
      OR: [
        { titulo:   { contains: buscar, mode: 'insensitive' } },
        { entidad:  { nombre: { contains: buscar, mode: 'insensitive' } } },
        { lead:     { nombre: { contains: buscar, mode: 'insensitive' } } },
        { lead:     { compania: { contains: buscar, mode: 'insensitive' } } },
      ],
    }),
  };

  try {
    if (vista === 'kanban') {
      // Devuelve todas las oportunidades abiertas agrupadas por etapa
      const opps = await prisma.oportunidadVenta.findMany({
        where: { ...donde, etapa: { notIn: ['CERRADO_GANADO', 'CERRADO_PERDIDO'] } },
        orderBy: { actualizadoEn: 'desc' },
        include: {
          entidad: { select: { id: true, nombre: true } },
          lead:    { select: { id: true, nombre: true, apellido: true, compania: true } },
        },
      });

      const kanban = {};
      for (const e of ETAPAS.slice(0, 4)) kanban[e] = [];
      for (const o of opps) {
        if (kanban[o.etapa]) kanban[o.etapa].push(fmtOp(o));
      }

      const metricas = await calcularMetricas(empresaId);
      return res.json({ kanban, metricas });
    }

    const [total, opps] = await prisma.$transaction([
      prisma.oportunidadVenta.count({ where: donde }),
      prisma.oportunidadVenta.findMany({
        where: donde,
        orderBy: { actualizadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          entidad: { select: { id: true, nombre: true } },
          lead:    { select: { id: true, nombre: true, apellido: true, compania: true } },
        },
      }),
    ]);

    return res.json({
      datos: opps.map(fmtOp),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener oportunidades' });
  }
}

// GET /api/oportunidades/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const op = await prisma.oportunidadVenta.findFirst({
      where: { id, empresaId },
      include: {
        lead:       { select: { id: true, nombre: true, apellido: true, compania: true, email: true, telefono: true } },
        actividades: { orderBy: { fecha: 'desc' }, take: 20 },
      },
    });
    if (!op) return res.status(404).json({ error: 'Oportunidad no encontrada' });
    return res.json({ ...fmtOp(op), actividades: op.actividades });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener oportunidad' });
  }
}

// POST /api/oportunidades
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { entidadId, leadId, titulo, valor, etapa, probabilidad, fechaCierre, notas } = req.body;

  if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });

  const etapaNorm = etapa ? etapa.toUpperCase() : 'PROSPECTO';
  if (!ETAPAS.includes(etapaNorm)) {
    return res.status(400).json({ error: `Etapa debe ser: ${ETAPAS.join(', ')}` });
  }

  if (entidadId) {
    const entidadExiste = await prisma.entidad.findFirst({ where: { id: parseInt(entidadId), empresaId } });
    if (!entidadExiste) return res.status(404).json({ error: 'Entidad no encontrada' });
  }
  if (leadId) {
    const leadExiste = await prisma.lead.findFirst({ where: { id: parseInt(leadId), empresaId } });
    if (!leadExiste) return res.status(404).json({ error: 'Lead no encontrado' });
  }

  try {
    const op = await prisma.oportunidadVenta.create({
      data: {
        empresaId,
        entidadId:    entidadId ? parseInt(entidadId) : null,
        leadId:       leadId    ? parseInt(leadId)    : null,
        titulo:       titulo.trim(),
        valor:        valor !== undefined && valor !== '' ? parseFloat(valor) : null,
        etapa:        etapaNorm,
        probabilidad: probabilidad !== undefined ? parseInt(probabilidad) : PROB_DEFAULT[etapaNorm],
        fechaCierre:  fechaCierre ? new Date(fechaCierre) : null,
        notas:        notas?.trim() || null,
      },
      include: {
        entidad: { select: { id: true, nombre: true } },
        lead:    { select: { id: true, nombre: true, apellido: true, compania: true } },
      },
    });
    return res.status(201).json(fmtOp(op));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear oportunidad' });
  }
}

// PUT /api/oportunidades/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { titulo, valor, etapa, probabilidad, fechaCierre, notas, entidadId, leadId } = req.body;

  if (etapa && !ETAPAS.includes(etapa.toUpperCase())) {
    return res.status(400).json({ error: `Etapa debe ser: ${ETAPAS.join(', ')}` });
  }

  try {
    const existe = await prisma.oportunidadVenta.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada' });

    const etapaNorm = etapa ? etapa.toUpperCase() : undefined;
    const op = await prisma.oportunidadVenta.update({
      where: { id },
      data: {
        ...(titulo      && { titulo: titulo.trim() }),
        ...(valor       !== undefined && { valor: valor !== '' ? parseFloat(valor) : null }),
        ...(etapaNorm   && { etapa: etapaNorm, probabilidad: PROB_DEFAULT[etapaNorm] }),
        ...(probabilidad !== undefined && { probabilidad: parseInt(probabilidad) }),
        ...(fechaCierre !== undefined && { fechaCierre: fechaCierre ? new Date(fechaCierre) : null }),
        ...(notas       !== undefined && { notas: notas?.trim() || null }),
        ...(entidadId   !== undefined && { entidadId: entidadId ? parseInt(entidadId) : null }),
        ...(leadId      !== undefined && { leadId: leadId ? parseInt(leadId) : null }),
      },
      include: { lead: { select: { id: true, nombre: true, apellido: true, compania: true } } },
    });
    return res.json(fmtOp(op));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar oportunidad' });
  }
}

// PATCH /api/oportunidades/:id/etapa  — mover en el Kanban
async function cambiarEtapa(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { etapa } = req.body;
  if (!etapa || !ETAPAS.includes(etapa.toUpperCase())) {
    return res.status(400).json({ error: `Etapa debe ser: ${ETAPAS.join(', ')}` });
  }

  try {
    const existe = await prisma.oportunidadVenta.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada' });

    const etapaNorm = etapa.toUpperCase();
    const op = await prisma.oportunidadVenta.update({
      where: { id },
      data: { etapa: etapaNorm, probabilidad: PROB_DEFAULT[etapaNorm] },
      include: { lead: { select: { id: true, nombre: true, apellido: true, compania: true } } },
    });
    return res.json(fmtOp(op));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar etapa' });
  }
}

// DELETE /api/oportunidades/:id
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.oportunidadVenta.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada' });

    await prisma.$transaction([
      prisma.actividadCRM.deleteMany({ where: { oportunidadId: id } }),
      prisma.oportunidadVenta.delete({ where: { id } }),
    ]);
    return res.json({ mensaje: 'Oportunidad eliminada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar oportunidad' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtOp(o) {
  return { ...o, valor: o.valor !== null ? R(o.valor) : null };
}

async function calcularMetricas(empresaId) {
  const opps = await prisma.oportunidadVenta.findMany({
    where: { empresaId },
    select: { etapa: true, valor: true, probabilidad: true },
  });

  let totalPipeline = 0, totalGanado = 0, totalPerdido = 0, ponderado = 0;
  let countGanado = 0, countPerdido = 0, countActivo = 0;

  for (const o of opps) {
    const v = o.valor !== null ? Number(o.valor) : 0;
    if (o.etapa === 'CERRADO_GANADO')   { totalGanado  += v; countGanado++;  }
    else if (o.etapa === 'CERRADO_PERDIDO') { totalPerdido += v; countPerdido++; }
    else { totalPipeline += v; ponderado += v * (o.probabilidad / 100); countActivo++; }
  }

  return {
    totalPipeline: R(totalPipeline),
    pipelinePonderado: R(ponderado),
    totalGanado:   R(totalGanado),
    totalPerdido:  R(totalPerdido),
    countActivo, countGanado, countPerdido,
  };
}

module.exports = { listar, obtener, crear, actualizar, cambiarEtapa, eliminar };
