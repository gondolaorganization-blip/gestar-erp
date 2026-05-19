const prisma = require('../config/prisma');

// GET /api/contactos
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina    = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite    = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar    = req.query.buscar?.trim() || '';
  const entidadId = parseInt(req.query.entidadId) || null;

  const donde = {
    empresaId,
    ...(entidadId && { entidadId }),
    ...(buscar && {
      OR: [
        { nombre:   { contains: buscar, mode: 'insensitive' } },
        { apellido: { contains: buscar, mode: 'insensitive' } },
        { email:    { contains: buscar, mode: 'insensitive' } },
        { cargo:    { contains: buscar, mode: 'insensitive' } },
        { entidad: { nombre: { contains: buscar, mode: 'insensitive' } } },
      ],
    }),
  };

  try {
    const [total, contactos] = await prisma.$transaction([
      prisma.contacto.count({ where: donde }),
      prisma.contacto.findMany({
        where: donde,
        orderBy: [{ entidad: { nombre: 'asc' } }, { nombre: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { entidad: { select: { id: true, nombre: true, estado: true } } },
      }),
    ]);

    return res.json({
      datos: contactos,
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener contactos' });
  }
}

// POST /api/contactos
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { entidadId, nombre, apellido, cargo, email, telefono, notas } = req.body;

  if (!entidadId)      return res.status(400).json({ error: 'La entidad es requerida' });
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const entidad = await prisma.entidad.findFirst({ where: { id: parseInt(entidadId), empresaId } });
    if (!entidad) return res.status(404).json({ error: 'Entidad no encontrada' });

    const contacto = await prisma.contacto.create({
      data: {
        empresaId,
        entidadId: parseInt(entidadId),
        nombre:    nombre.trim(),
        apellido:  apellido?.trim()  || null,
        cargo:     cargo?.trim()     || null,
        email:     email?.trim()     || null,
        telefono:  telefono?.trim()  || null,
        notas:     notas?.trim()     || null,
      },
      include: { entidad: { select: { id: true, nombre: true, estado: true } } },
    });
    return res.status(201).json(contacto);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear contacto' });
  }
}

// PUT /api/contactos/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { entidadId, nombre, apellido, cargo, email, telefono, notas } = req.body;

  try {
    const existe = await prisma.contacto.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Contacto no encontrado' });

    const contacto = await prisma.contacto.update({
      where: { id },
      data: {
        ...(entidadId !== undefined && { entidadId: parseInt(entidadId) }),
        ...(nombre    && { nombre:   nombre.trim() }),
        ...(apellido  !== undefined && { apellido:  apellido?.trim()  || null }),
        ...(cargo     !== undefined && { cargo:     cargo?.trim()     || null }),
        ...(email     !== undefined && { email:     email?.trim()     || null }),
        ...(telefono  !== undefined && { telefono:  telefono?.trim()  || null }),
        ...(notas     !== undefined && { notas:     notas?.trim()     || null }),
      },
      include: { entidad: { select: { id: true, nombre: true, estado: true } } },
    });
    return res.json(contacto);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar contacto' });
  }
}

// DELETE /api/contactos/:id
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.contacto.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Contacto no encontrado' });

    await prisma.actividadCRM.updateMany({ where: { contactoId: id }, data: { contactoId: null } });
    await prisma.contacto.delete({ where: { id } });
    return res.json({ mensaje: 'Contacto eliminado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar contacto' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
