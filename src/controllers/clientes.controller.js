const prisma = require('../config/prisma');

const TIPOS_DOC_VALIDOS = ['RUC', 'CEDULA', 'PASAPORTE'];

// GET /api/clientes
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const soloActivos = req.query.inactivos !== 'true';

  const donde = {
    empresaId,
    ...(soloActivos && { activo: true }),
    ...(buscar && {
      OR: [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { numDoc: { contains: buscar, mode: 'insensitive' } },
        { email: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, clientes] = await prisma.$transaction([
      prisma.cliente.count({ where: donde }),
      prisma.cliente.findMany({
        where: donde,
        orderBy: { nombre: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          tipoDoc: true,
          numDoc: true,
          nombre: true,
          email: true,
          telefono: true,
          activo: true,
          creadoEn: true,
        },
      }),
    ]);

    return res.json({
      datos: clientes,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  }
}

// GET /api/clientes/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id, empresaId },
    });

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    return res.json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el cliente' });
  }
}

// POST /api/clientes
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { tipoDoc, numDoc, nombre, email, telefono, direccion } = req.body;

  if (!tipoDoc || !numDoc || !nombre) {
    return res.status(400).json({ error: 'Tipo de documento, número y nombre son requeridos' });
  }
  if (!TIPOS_DOC_VALIDOS.includes(tipoDoc)) {
    return res.status(400).json({ error: `Tipo de documento debe ser: ${TIPOS_DOC_VALIDOS.join(', ')}` });
  }
  if (nombre.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  }

  try {
    const cliente = await prisma.cliente.create({
      data: {
        empresaId,
        tipoDoc,
        numDoc: numDoc.trim(),
        nombre: nombre.trim(),
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        direccion: direccion?.trim() || null,
      },
    });

    return res.status(201).json(cliente);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente con ese tipo y número de documento' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el cliente' });
  }
}

// PUT /api/clientes/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { tipoDoc, numDoc, nombre, email, telefono, direccion } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  if (tipoDoc && !TIPOS_DOC_VALIDOS.includes(tipoDoc)) {
    return res.status(400).json({ error: `Tipo de documento debe ser: ${TIPOS_DOC_VALIDOS.join(', ')}` });
  }
  if (nombre !== undefined && nombre.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  }

  try {
    const existe = await prisma.cliente.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Cliente no encontrado' });

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(tipoDoc && { tipoDoc }),
        ...(numDoc && { numDoc: numDoc.trim() }),
        ...(nombre && { nombre: nombre.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
      },
    });

    return res.json(cliente);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente con ese tipo y número de documento' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
}

// DELETE /api/clientes/:id  (baja lógica)
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.cliente.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Verificar si tiene facturas pendientes
    const facturasPendientes = await prisma.factura.count({
      where: { clienteId: id, estado: { in: ['PENDIENTE', 'VENCIDA'] } },
    });
    if (facturasPendientes > 0) {
      return res.status(409).json({
        error: `No se puede desactivar: el cliente tiene ${facturasPendientes} factura(s) pendiente(s)`,
      });
    }

    await prisma.cliente.update({ where: { id }, data: { activo: false } });

    return res.json({ mensaje: 'Cliente desactivado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
