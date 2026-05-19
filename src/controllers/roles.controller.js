const prisma = require('../config/prisma');
const { PLANTILLAS_ROLES, MODULOS, ACCIONES } = require('../config/roles');

// Plantilla de permisos vacíos
const permisosVacios = () =>
  Object.fromEntries(MODULOS.map((m) => [m, Object.fromEntries(ACCIONES.map((a) => [a, false]))]));

// Índice por nombre para lookup rápido
const PLANTILLAS = Object.fromEntries(PLANTILLAS_ROLES.map((r) => [r.nombre, r.permisos]));

// GET /api/usuarios/roles
async function listar(req, res) {
  try {
    const roles = await prisma.rol.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { usuarios: true } } },
    });

    return res.json(
      roles.map((r) => ({ ...r, totalUsuarios: r._count.usuarios, _count: undefined }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener roles' });
  }
}

// GET /api/usuarios/roles/plantillas
function plantillas(req, res) {
  return res.json({
    disponibles: Object.keys(PLANTILLAS),
    modulos: MODULOS,
    acciones: ACCIONES,
    plantillas: PLANTILLAS,
  });
}

// POST /api/usuarios/roles
async function crear(req, res) {
  const { nombre, descripcion, permisos, plantilla } = req.body;

  if (!nombre) return res.status(400).json({ error: 'El nombre del rol es requerido' });

  const permisosFinales = plantilla && PLANTILLAS[plantilla.toUpperCase()]
    ? PLANTILLAS[plantilla.toUpperCase()]
    : permisos ?? permisosVacios();

  try {
    const rol = await prisma.rol.create({
      data: {
        nombre: nombre.trim().toUpperCase(),
        descripcion: descripcion?.trim() || null,
        permisos: permisosFinales,
      },
    });
    return res.status(201).json(rol);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el rol' });
  }
}

// PUT /api/usuarios/roles/:id
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  const { descripcion, permisos } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const rol = await prisma.rol.findUnique({ where: { id } });
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    if (rol.nombre === 'ADMIN') {
      return res.status(409).json({ error: 'El rol ADMIN no puede modificarse' });
    }

    const actualizado = await prisma.rol.update({
      where: { id },
      data: {
        ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(permisos && { permisos }),
      },
    });
    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el rol' });
  }
}

// DELETE /api/usuarios/roles/:id
async function eliminar(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const rol = await prisma.rol.findUnique({
      where: { id },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    if (rol.nombre === 'ADMIN') {
      return res.status(409).json({ error: 'El rol ADMIN no puede eliminarse' });
    }
    if (rol._count.usuarios > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: ${rol._count.usuarios} usuario(s) tienen este rol asignado`,
      });
    }

    await prisma.rol.delete({ where: { id } });
    return res.json({ mensaje: 'Rol eliminado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar el rol' });
  }
}

module.exports = { listar, plantillas, crear, actualizar, eliminar };
