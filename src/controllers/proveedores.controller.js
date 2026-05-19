const prisma = require('../config/prisma');

// GET /api/proveedores
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina    = Math.max(1, parseInt(req.query.pagina)  || 1);
  const limite    = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar    = req.query.buscar?.trim() || '';
  const soloActivos = req.query.inactivos !== 'true';

  const donde = {
    empresaId,
    ...(soloActivos && { activo: true }),
    ...(buscar && {
      OR: [
        { nombre:    { contains: buscar, mode: 'insensitive' } },
        { ruc:       { contains: buscar, mode: 'insensitive' } },
        { email:     { contains: buscar, mode: 'insensitive' } },
        { telefono:  { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, proveedores] = await prisma.$transaction([
      prisma.proveedor.count({ where: donde }),
      prisma.proveedor.findMany({
        where: donde,
        orderBy: { nombre: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true, ruc: true, nombre: true, email: true,
          telefono: true, direccion: true, activo: true, creadoEn: true,
        },
      }),
    ]);

    return res.json({
      datos: proveedores,
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener proveedores' });
  }
}

// GET /api/proveedores/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const proveedor = await prisma.proveedor.findFirst({ where: { id, empresaId } });
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    return res.json(proveedor);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el proveedor' });
  }
}

// POST /api/proveedores
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { ruc, nombre, email, telefono, direccion } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre del proveedor es requerido' });
  }
  if (nombre.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  }

  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        empresaId,
        ruc:       ruc?.trim()       || null,
        nombre:    nombre.trim(),
        email:     email?.trim()     || null,
        telefono:  telefono?.trim()  || null,
        direccion: direccion?.trim() || null,
      },
    });
    return res.status(201).json(proveedor);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el proveedor' });
  }
}

// PUT /api/proveedores/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { ruc, nombre, email, telefono, direccion } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (nombre !== undefined && nombre.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  }

  try {
    const existe = await prisma.proveedor.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        ...(ruc       !== undefined && { ruc:       ruc?.trim()       || null }),
        ...(nombre    !== undefined && { nombre:    nombre.trim()             }),
        ...(email     !== undefined && { email:     email?.trim()     || null }),
        ...(telefono  !== undefined && { telefono:  telefono?.trim()  || null }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
      },
    });
    return res.json(proveedor);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el proveedor' });
  }
}

// DELETE /api/proveedores/:id  (baja lógica)
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.proveedor.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });

    await prisma.proveedor.update({ where: { id }, data: { activo: false } });
    return res.json({ mensaje: 'Proveedor desactivado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar el proveedor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
