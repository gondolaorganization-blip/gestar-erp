const prisma = require('../config/prisma');

const TIPOS = ['LLAMADA', 'EMAIL', 'REUNION', 'NOTA', 'TAREA'];

// GET /api/actividades-crm
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const entidadId     = parseInt(req.query.entidadId)     || null;
  const contactoId    = parseInt(req.query.contactoId)    || null;
  const leadId        = parseInt(req.query.leadId)        || null;
  const oportunidadId = parseInt(req.query.oportunidadId) || null;
  const soloP         = req.query.pendientes === 'true';
  const pagina        = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite        = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));

  const donde = {
    empresaId,
    ...(entidadId     && { entidadId }),
    ...(contactoId    && { contactoId }),
    ...(leadId        && { leadId }),
    ...(oportunidadId && { oportunidadId }),
    ...(soloP         && { completada: false }),
  };

  try {
    const [total, actividades] = await prisma.$transaction([
      prisma.actividadCRM.count({ where: donde }),
      prisma.actividadCRM.findMany({
        where: donde,
        orderBy: { fecha: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          entidad:     { select: { id: true, nombre: true } },
          contacto:    { select: { id: true, nombre: true, apellido: true } },
          lead:        { select: { id: true, nombre: true, apellido: true } },
          oportunidad: { select: { id: true, titulo: true } },
        },
      }),
    ]);

    return res.json({
      datos: actividades,
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener actividades' });
  }
}

// POST /api/actividades-crm
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { entidadId, contactoId, leadId, oportunidadId, tipo, titulo, descripcion, fecha, completada } = req.body;

  if (!tipo || !TIPOS.includes(tipo.toUpperCase())) {
    return res.status(400).json({ error: `Tipo debe ser: ${TIPOS.join(', ')}` });
  }
  if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
  if (!fecha)          return res.status(400).json({ error: 'La fecha es requerida' });

  if (!entidadId && !contactoId && !leadId && !oportunidadId) {
    return res.status(400).json({ error: 'Se requiere al menos una referencia (entidad, contacto, lead u oportunidad)' });
  }

  try {
    const act = await prisma.actividadCRM.create({
      data: {
        empresaId,
        entidadId:     entidadId     ? parseInt(entidadId)     : null,
        contactoId:    contactoId    ? parseInt(contactoId)    : null,
        leadId:        leadId        ? parseInt(leadId)        : null,
        oportunidadId: oportunidadId ? parseInt(oportunidadId) : null,
        tipo:          tipo.toUpperCase(),
        titulo:        titulo.trim(),
        descripcion:   descripcion?.trim() || null,
        fecha:         new Date(fecha),
        completada:    completada === true || completada === 'true',
      },
      include: {
        entidad:     { select: { id: true, nombre: true } },
        contacto:    { select: { id: true, nombre: true, apellido: true } },
        lead:        { select: { id: true, nombre: true, apellido: true } },
        oportunidad: { select: { id: true, titulo: true } },
      },
    });
    return res.status(201).json(act);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear actividad' });
  }
}

// PATCH /api/actividades-crm/:id/completar
async function completar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.actividadCRM.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Actividad no encontrada' });

    const act = await prisma.actividadCRM.update({
      where: { id },
      data: { completada: !existe.completada },
    });
    return res.json(act);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar actividad' });
  }
}

// DELETE /api/actividades-crm/:id
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.actividadCRM.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Actividad no encontrada' });

    await prisma.actividadCRM.delete({ where: { id } });
    return res.json({ mensaje: 'Actividad eliminada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar actividad' });
  }
}

module.exports = { listar, crear, completar, eliminar };
