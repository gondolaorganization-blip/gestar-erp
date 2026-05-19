const prisma = require('../config/prisma');

const ESTADOS    = ['PROSPECTO', 'ACTIVO', 'INACTIVO'];
const INDUSTRIAS = ['TECNOLOGIA', 'SALUD', 'EDUCACION', 'COMERCIO', 'CONSTRUCCION',
                    'FINANZAS', 'TURISMO', 'MANUFACTURA', 'SERVICIOS', 'OTRO'];

// GET /api/entidades
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const estado = req.query.estado?.toUpperCase() || '';

  const donde = {
    empresaId,
    ...(estado && ESTADOS.includes(estado) && { estado }),
    ...(buscar && {
      OR: [
        { nombre:    { contains: buscar, mode: 'insensitive' } },
        { ruc:       { contains: buscar, mode: 'insensitive' } },
        { email:     { contains: buscar, mode: 'insensitive' } },
        { industria: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, entidades] = await prisma.$transaction([
      prisma.entidad.count({ where: donde }),
      prisma.entidad.findMany({
        where: donde,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          _count: { select: { contactos: true, oportunidades: true } },
        },
      }),
    ]);

    const resumen = await contarPorEstado(empresaId);

    return res.json({
      datos: entidades.map(fmt),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
      resumen,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener entidades' });
  }
}

// GET /api/entidades/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const entidad = await prisma.entidad.findFirst({
      where: { id, empresaId },
      include: {
        contactos:    { orderBy: { nombre: 'asc' } },
        oportunidades: { orderBy: { actualizadoEn: 'desc' }, take: 10,
          select: { id: true, titulo: true, etapa: true, valor: true, fechaCierre: true } },
        actividades:  { orderBy: { fecha: 'desc' }, take: 10,
          select: { id: true, tipo: true, titulo: true, fecha: true, completada: true } },
      },
    });
    if (!entidad) return res.status(404).json({ error: 'Entidad no encontrada' });
    return res.json(fmt(entidad));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener entidad' });
  }
}

// POST /api/entidades
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { nombre, ruc, industria, website, email, telefono, direccion, notas, estado } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (estado && !ESTADOS.includes(estado.toUpperCase()))
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });

  try {
    const entidad = await prisma.entidad.create({
      data: {
        empresaId,
        nombre:    nombre.trim(),
        ruc:       ruc?.trim()       || null,
        industria: industria?.trim() || null,
        website:   website?.trim()   || null,
        email:     email?.trim()     || null,
        telefono:  telefono?.trim()  || null,
        direccion: direccion?.trim() || null,
        notas:     notas?.trim()     || null,
        estado:    estado ? estado.toUpperCase() : 'PROSPECTO',
      },
    });
    return res.status(201).json(fmt(entidad));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear entidad' });
  }
}

// PUT /api/entidades/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { nombre, ruc, industria, website, email, telefono, direccion, notas, estado } = req.body;
  if (estado && !ESTADOS.includes(estado.toUpperCase()))
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });

  try {
    const existe = await prisma.entidad.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Entidad no encontrada' });

    const entidad = await prisma.entidad.update({
      where: { id },
      data: {
        ...(nombre    && { nombre: nombre.trim() }),
        ...(ruc       !== undefined && { ruc:       ruc?.trim()       || null }),
        ...(industria !== undefined && { industria: industria?.trim() || null }),
        ...(website   !== undefined && { website:   website?.trim()   || null }),
        ...(email     !== undefined && { email:     email?.trim()     || null }),
        ...(telefono  !== undefined && { telefono:  telefono?.trim()  || null }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
        ...(notas     !== undefined && { notas:     notas?.trim()     || null }),
        ...(estado    && { estado: estado.toUpperCase() }),
      },
    });
    return res.json(fmt(entidad));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar entidad' });
  }
}

// DELETE /api/entidades/:id
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.entidad.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Entidad no encontrada' });

    await prisma.$transaction([
      prisma.actividadCRM.deleteMany({  where: { entidadId: id } }),
      prisma.oportunidadVenta.updateMany({ where: { entidadId: id }, data: { entidadId: null } }),
      prisma.lead.updateMany({          where: { entidadId: id }, data: { entidadId: null } }),
      prisma.contacto.deleteMany({      where: { entidadId: id } }),
      prisma.entidad.delete({           where: { id } }),
    ]);

    return res.json({ mensaje: 'Entidad eliminada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar entidad' });
  }
}

// POST /api/entidades/:id/convertir  — crea Cliente a partir de la Entidad
async function convertirACliente(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { tipoDoc, numDoc, nombre, email, telefono, direccion } = req.body;
  if (!numDoc?.trim()) return res.status(400).json({ error: 'El número de documento es requerido' });
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const entidad = await prisma.entidad.findFirst({ where: { id, empresaId } });
    if (!entidad) return res.status(404).json({ error: 'Entidad no encontrada' });

    const cliente = await prisma.$transaction(async (tx) => {
      const c = await tx.cliente.create({
        data: {
          empresaId,
          tipoDoc:   tipoDoc || 'RUC',
          numDoc:    numDoc.trim(),
          nombre:    nombre.trim(),
          email:     email?.trim()     || null,
          telefono:  telefono?.trim()  || null,
          direccion: direccion?.trim() || null,
        },
      });
      await tx.entidad.update({
        where: { id },
        data: { estado: 'ACTIVO', clienteId: c.id },
      });
      return c;
    });

    return res.status(201).json({ cliente, mensaje: 'Entidad convertida a cliente exitosamente' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002')
      return res.status(409).json({ error: 'Ya existe un cliente con ese número de documento' });
    return res.status(500).json({ error: 'Error al convertir a cliente' });
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(e) {
  return {
    ...e,
    cantidadContactos:     e._count?.contactos     ?? 0,
    cantidadOportunidades: e._count?.oportunidades ?? 0,
    _count: undefined,
  };
}

async function contarPorEstado(empresaId) {
  const grupos = await prisma.entidad.groupBy({
    by: ['estado'],
    where: { empresaId },
    _count: true,
  });
  return Object.fromEntries(grupos.map((g) => [g.estado, g._count]));
}

module.exports = { listar, obtener, crear, actualizar, eliminar, convertirACliente, INDUSTRIAS };
