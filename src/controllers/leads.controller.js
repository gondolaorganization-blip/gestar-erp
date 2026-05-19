const prisma = require('../config/prisma');

const ORIGENES = ['MANUAL', 'WEB', 'REFERIDO', 'LLAMADA', 'REDES_SOCIALES'];
const ESTADOS  = ['NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO'];

// GET /api/leads
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina  = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite  = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar  = req.query.buscar?.trim() || '';
  const estado  = req.query.estado?.toUpperCase() || '';
  const origen  = req.query.origen?.toUpperCase() || '';

  const donde = {
    empresaId,
    ...(estado && ESTADOS.includes(estado)  && { estado }),
    ...(origen && ORIGENES.includes(origen) && { origen }),
    ...(buscar && {
      OR: [
        { nombre:   { contains: buscar, mode: 'insensitive' } },
        { apellido: { contains: buscar, mode: 'insensitive' } },
        { email:    { contains: buscar, mode: 'insensitive' } },
        { compania: { contains: buscar, mode: 'insensitive' } },
        { cargo:    { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, leads] = await prisma.$transaction([
      prisma.lead.count({ where: donde }),
      prisma.lead.findMany({
        where: donde,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          _count: { select: { oportunidades: true, actividades: true } },
        },
      }),
    ]);

    const resumen = await contarPorEstado(empresaId);

    return res.json({
      datos: leads.map(fmt),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
      resumen,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener leads' });
  }
}

// GET /api/leads/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, empresaId },
      include: {
        oportunidades: { orderBy: { creadoEn: 'desc' } },
        actividades:   { orderBy: { fecha: 'desc' }, take: 20 },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    return res.json({
      ...fmt(lead),
      oportunidades: lead.oportunidades.map(fmtOp),
      actividades:   lead.actividades,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener lead' });
  }
}

// POST /api/leads
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { nombre, apellido, email, telefono, compania, cargo, origen, estado, notas } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (origen && !ORIGENES.includes(origen.toUpperCase())) {
    return res.status(400).json({ error: `Origen debe ser: ${ORIGENES.join(', ')}` });
  }
  if (estado && !ESTADOS.includes(estado.toUpperCase())) {
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        empresaId,
        nombre:   nombre.trim(),
        apellido: apellido?.trim() || null,
        email:    email?.trim()    || null,
        telefono: telefono?.trim() || null,
        compania: compania?.trim() || null,
        cargo:    cargo?.trim()    || null,
        origen:   origen  ? origen.toUpperCase()  : 'MANUAL',
        estado:   estado  ? estado.toUpperCase()  : 'NUEVO',
        notas:    notas?.trim()    || null,
      },
    });
    return res.status(201).json(fmt(lead));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear lead' });
  }
}

// PUT /api/leads/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { nombre, apellido, email, telefono, compania, cargo, origen, estado, notas } = req.body;

  if (origen && !ORIGENES.includes(origen.toUpperCase())) {
    return res.status(400).json({ error: `Origen debe ser: ${ORIGENES.join(', ')}` });
  }
  if (estado && !ESTADOS.includes(estado.toUpperCase())) {
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });
  }

  try {
    const existe = await prisma.lead.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Lead no encontrado' });

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(nombre    && { nombre:   nombre.trim() }),
        ...(apellido  !== undefined && { apellido: apellido?.trim()  || null }),
        ...(email     !== undefined && { email:    email?.trim()     || null }),
        ...(telefono  !== undefined && { telefono: telefono?.trim()  || null }),
        ...(compania  !== undefined && { compania: compania?.trim()  || null }),
        ...(cargo     !== undefined && { cargo:    cargo?.trim()     || null }),
        ...(origen    && { origen:   origen.toUpperCase() }),
        ...(estado    && { estado:   estado.toUpperCase() }),
        ...(notas     !== undefined && { notas:    notas?.trim()     || null }),
      },
    });
    return res.json(fmt(lead));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar lead' });
  }
}

// DELETE /api/leads/:id
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.lead.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Lead no encontrado' });

    await prisma.$transaction([
      prisma.actividadCRM.deleteMany({ where: { leadId: id } }),
      prisma.lead.delete({ where: { id } }),
    ]);

    return res.json({ mensaje: 'Lead eliminado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar lead' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(l) {
  return {
    ...l,
    nombreCompleto: [l.nombre, l.apellido].filter(Boolean).join(' '),
    cantidadOportunidades: l._count?.oportunidades ?? 0,
    cantidadActividades:   l._count?.actividades   ?? 0,
    _count: undefined,
  };
}

function fmtOp(o) {
  return { ...o, valor: o.valor !== null ? Number(o.valor) : null };
}

async function contarPorEstado(empresaId) {
  const grupos = await prisma.lead.groupBy({
    by: ['estado'],
    where: { empresaId },
    _count: true,
  });
  return Object.fromEntries(grupos.map((g) => [g.estado, g._count]));
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
