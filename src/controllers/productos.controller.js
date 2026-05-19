const prisma = require('../config/prisma');

const TIPOS_VALIDOS = ['BIEN', 'SERVICIO'];
const TASA_ITBMS = 0.07; // 7% — tasa general ITBMS Panamá

// GET /api/productos
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const tipo = req.query.tipo?.toUpperCase() || '';
  const soloActivos = req.query.inactivos !== 'true';

  const donde = {
    empresaId,
    ...(soloActivos && { activo: true }),
    ...(tipo && TIPOS_VALIDOS.includes(tipo) && { tipo }),
    ...(buscar && {
      OR: [
        { codigo: { contains: buscar, mode: 'insensitive' } },
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { descripcion: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, productos] = await prisma.$transaction([
      prisma.producto.count({ where: donde }),
      prisma.producto.findMany({
        where: donde,
        orderBy: { nombre: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
          tipo: true,
          precio: true,
          itbms: true,
          activo: true,
          creadoEn: true,
        },
      }),
    ]);

    // Calcular precio con ITBMS para cada producto
    const datos = productos.map((p) => ({
      ...p,
      precio: Number(p.precio),
      precioConItbms: p.itbms
        ? Number((Number(p.precio) * (1 + TASA_ITBMS)).toFixed(2))
        : Number(p.precio),
      tasaItbms: p.itbms ? TASA_ITBMS : 0,
    }));

    return res.json({
      datos,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener productos' });
  }
}

// GET /api/productos/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const producto = await prisma.producto.findFirst({
      where: { id, empresaId },
    });

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    return res.json({
      ...producto,
      precio: Number(producto.precio),
      precioConItbms: producto.itbms
        ? Number((Number(producto.precio) * (1 + TASA_ITBMS)).toFixed(2))
        : Number(producto.precio),
      tasaItbms: producto.itbms ? TASA_ITBMS : 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el producto' });
  }
}

// POST /api/productos
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { codigo, nombre, descripcion, tipo, precio, itbms } = req.body;

  if (!codigo || !nombre || precio === undefined) {
    return res.status(400).json({ error: 'Código, nombre y precio son requeridos' });
  }
  if (tipo && !TIPOS_VALIDOS.includes(tipo.toUpperCase())) {
    return res.status(400).json({ error: `Tipo debe ser: ${TIPOS_VALIDOS.join(', ')}` });
  }
  const precioNum = parseFloat(precio);
  if (isNaN(precioNum) || precioNum < 0) {
    return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a 0' });
  }

  try {
    const producto = await prisma.producto.create({
      data: {
        empresaId,
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        tipo: tipo ? tipo.toUpperCase() : 'SERVICIO',
        precio: precioNum,
        itbms: itbms === true || itbms === 'true',
      },
    });

    return res.status(201).json({
      ...producto,
      precio: Number(producto.precio),
      precioConItbms: producto.itbms
        ? Number((Number(producto.precio) * (1 + TASA_ITBMS)).toFixed(2))
        : Number(producto.precio),
      tasaItbms: producto.itbms ? TASA_ITBMS : 0,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un producto con ese código' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el producto' });
  }
}

// PUT /api/productos/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { codigo, nombre, descripcion, tipo, precio, itbms } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  if (tipo && !TIPOS_VALIDOS.includes(tipo.toUpperCase())) {
    return res.status(400).json({ error: `Tipo debe ser: ${TIPOS_VALIDOS.join(', ')}` });
  }
  if (precio !== undefined) {
    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a 0' });
    }
  }

  try {
    const existe = await prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });

    const producto = await prisma.producto.update({
      where: { id },
      data: {
        ...(codigo && { codigo: codigo.trim().toUpperCase() }),
        ...(nombre && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(tipo && { tipo: tipo.toUpperCase() }),
        ...(precio !== undefined && { precio: parseFloat(precio) }),
        ...(itbms !== undefined && { itbms: itbms === true || itbms === 'true' }),
      },
    });

    return res.json({
      ...producto,
      precio: Number(producto.precio),
      precioConItbms: producto.itbms
        ? Number((Number(producto.precio) * (1 + TASA_ITBMS)).toFixed(2))
        : Number(producto.precio),
      tasaItbms: producto.itbms ? TASA_ITBMS : 0,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un producto con ese código' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el producto' });
  }
}

// DELETE /api/productos/:id  (baja lógica)
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });

    // Verificar si está en facturas activas
    const enFacturas = await prisma.lineaFactura.count({
      where: {
        productoId: id,
        factura: { estado: { in: ['PENDIENTE', 'VENCIDA'] } },
      },
    });
    if (enFacturas > 0) {
      return res.status(409).json({
        error: `No se puede desactivar: el producto aparece en ${enFacturas} factura(s) pendiente(s)`,
      });
    }

    await prisma.producto.update({ where: { id }, data: { activo: false } });

    return res.json({ mensaje: 'Producto desactivado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar el producto' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
