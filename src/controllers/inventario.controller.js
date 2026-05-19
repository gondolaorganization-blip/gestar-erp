const prisma = require('../config/prisma');

const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE'];

// GET /api/inventario
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const alerta = req.query.alerta; // 'bajo' | 'sin'

  const donde = {
    empresaId,
    activo: true,
    tipo: 'BIEN',
    ...(buscar && {
      OR: [
        { codigo: { contains: buscar, mode: 'insensitive' } },
        { nombre: { contains: buscar, mode: 'insensitive' } },
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
          tipo: true,
          precio: true,
          costo: true,
          stock: true,
          stockMinimo: true,
          activo: true,
        },
      }),
    ]);

    let datos = productos.map((p) => ({
      ...p,
      precio: Number(p.precio),
      costo: p.costo !== null ? Number(p.costo) : null,
      stock: Number(p.stock),
      stockMinimo: Number(p.stockMinimo),
      estadoStock: calcularEstado(Number(p.stock), Number(p.stockMinimo)),
    }));

    // Filtro por alerta post-query (calculado)
    if (alerta === 'bajo') {
      datos = datos.filter((p) => p.estadoStock === 'BAJO');
    } else if (alerta === 'sin') {
      datos = datos.filter((p) => p.estadoStock === 'SIN_STOCK');
    }

    return res.json({
      datos,
      paginacion: {
        total: alerta ? datos.length : total,
        pagina,
        limite,
        totalPaginas: Math.ceil((alerta ? datos.length : total) / limite),
      },
      resumen: await resumenStock(empresaId),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener inventario' });
  }
}

// GET /api/inventario/:id  — detalle + kardex
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 30));

  try {
    const producto = await prisma.producto.findFirst({
      where: { id, empresaId },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const [totalMovs, movimientos] = await prisma.$transaction([
      prisma.movimientoInventario.count({ where: { productoId: id, empresaId } }),
      prisma.movimientoInventario.findMany({
        where: { productoId: id, empresaId },
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return res.json({
      producto: {
        ...producto,
        precio: Number(producto.precio),
        costo: producto.costo !== null ? Number(producto.costo) : null,
        stock: Number(producto.stock),
        stockMinimo: Number(producto.stockMinimo),
        estadoStock: calcularEstado(Number(producto.stock), Number(producto.stockMinimo)),
      },
      kardex: movimientos.map((m) => ({
        ...m,
        cantidad: Number(m.cantidad),
        costoUnit: m.costoUnit !== null ? Number(m.costoUnit) : null,
        saldoPost: Number(m.saldoPost),
      })),
      paginacion: {
        total: totalMovs,
        pagina,
        limite,
        totalPaginas: Math.ceil(totalMovs / limite),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el producto' });
  }
}

// POST /api/inventario/:id/movimiento  — entrada, salida o ajuste
async function registrarMovimiento(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { tipo, cantidad, costoUnit, referencia, notas } = req.body;

  if (!tipo || !TIPOS_MOVIMIENTO.includes(tipo.toUpperCase())) {
    return res.status(400).json({ error: `Tipo debe ser: ${TIPOS_MOVIMIENTO.join(', ')}` });
  }
  const cantNum = parseFloat(cantidad);
  if (isNaN(cantNum) || cantNum <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0' });
  }

  try {
    const producto = await prisma.producto.findFirst({
      where: { id, empresaId, activo: true },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (producto.tipo !== 'BIEN') {
      return res.status(400).json({ error: 'Solo se puede gestionar stock de productos de tipo BIEN' });
    }

    const stockActual = Number(producto.stock);
    const tipoNorm = tipo.toUpperCase();

    let nuevoStock;
    if (tipoNorm === 'ENTRADA') {
      nuevoStock = stockActual + cantNum;
    } else if (tipoNorm === 'SALIDA') {
      if (stockActual < cantNum) {
        return res.status(400).json({
          error: `Stock insuficiente. Disponible: ${stockActual}, solicitado: ${cantNum}`,
        });
      }
      nuevoStock = stockActual - cantNum;
    } else {
      // AJUSTE: la cantidad enviada es el nuevo saldo absoluto
      nuevoStock = cantNum;
    }

    nuevoStock = Math.round(nuevoStock * 10000) / 10000;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoInventario.create({
        data: {
          empresaId,
          productoId: id,
          tipo: tipoNorm,
          cantidad: tipoNorm === 'AJUSTE' ? Math.abs(nuevoStock - stockActual) : cantNum,
          costoUnit: costoUnit !== undefined ? parseFloat(costoUnit) : null,
          saldoPost: nuevoStock,
          referencia: referencia?.trim() || null,
          notas: notas?.trim() || null,
        },
      }),
      prisma.producto.update({
        where: { id },
        data: {
          stock: nuevoStock,
          ...(tipoNorm === 'ENTRADA' && costoUnit !== undefined && {
            costo: parseFloat(costoUnit),
          }),
        },
      }),
    ]);

    return res.status(201).json({
      movimiento: {
        ...movimiento,
        cantidad: Number(movimiento.cantidad),
        costoUnit: movimiento.costoUnit !== null ? Number(movimiento.costoUnit) : null,
        saldoPost: Number(movimiento.saldoPost),
      },
      stockAnterior: stockActual,
      stockActual: nuevoStock,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar movimiento' });
  }
}

// PATCH /api/inventario/:id/minimo  — actualizar stock mínimo
async function actualizarMinimo(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { stockMinimo } = req.body;
  const minimoNum = parseFloat(stockMinimo);
  if (isNaN(minimoNum) || minimoNum < 0) {
    return res.status(400).json({ error: 'El stock mínimo debe ser un número mayor o igual a 0' });
  }

  try {
    const existe = await prisma.producto.findFirst({ where: { id, empresaId, activo: true } });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });

    const producto = await prisma.producto.update({
      where: { id },
      data: { stockMinimo: minimoNum },
    });

    return res.json({
      id: producto.id,
      stockMinimo: Number(producto.stockMinimo),
      estadoStock: calcularEstado(Number(producto.stock), minimoNum),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar stock mínimo' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularEstado(stock, minimo) {
  if (stock <= 0) return 'SIN_STOCK';
  if (minimo > 0 && stock <= minimo) return 'BAJO';
  return 'OK';
}

async function resumenStock(empresaId) {
  const productos = await prisma.producto.findMany({
    where: { empresaId, activo: true, tipo: 'BIEN' },
    select: { stock: true, stockMinimo: true, costo: true },
  });

  let totalProductos = productos.length;
  let sinStock = 0;
  let bajoStock = 0;
  let valorTotal = 0;

  for (const p of productos) {
    const s = Number(p.stock);
    const m = Number(p.stockMinimo);
    const c = p.costo !== null ? Number(p.costo) : 0;
    if (s <= 0) sinStock++;
    else if (m > 0 && s <= m) bajoStock++;
    valorTotal += s * c;
  }

  return {
    totalProductos,
    sinStock,
    bajoStock,
    valorTotal: Math.round(valorTotal * 100) / 100,
  };
}

module.exports = { listar, obtener, registrarMovimiento, actualizarMinimo };
