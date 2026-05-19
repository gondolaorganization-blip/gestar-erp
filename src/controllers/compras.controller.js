const prisma = require('../config/prisma');
const { asientoOCRecibida, asientoPagoProveedor } = require('../services/contabilidad.service');

const TASA_ITBMS  = 0.07;
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA'];
const R = (n) => Number(Number(n ?? 0).toFixed(2));

// Crea movimientos ENTRADA en inventario al recibir una OC. Idempotente: no duplica si ya existen.
async function aplicarEntradaInventario(tx, ordenId, numero, empresaId) {
  const existe = await tx.movimientoInventario.findFirst({ where: { empresaId, referencia: numero } });
  if (existe) return;

  const [lineas, orden] = await Promise.all([
    tx.lineaOrdenCompra.findMany({ where: { ordenCompraId: ordenId } }),
    tx.ordenCompra.findUnique({ where: { id: ordenId }, select: { subtotal: true, itbms: true, total: true, fecha: true, numero: true } }),
  ]);

  for (const l of lineas) {
    if (!l.productoId) continue;
    const prod = await tx.producto.findUnique({ where: { id: l.productoId }, select: { stock: true } });
    const nuevoStock = Number((Number(prod?.stock ?? 0) + Number(l.cantidad)).toFixed(4));
    await tx.producto.update({ where: { id: l.productoId }, data: { stock: nuevoStock } });
    await tx.movimientoInventario.create({
      data: {
        empresaId, productoId: l.productoId,
        tipo: 'ENTRADA', cantidad: Number(l.cantidad),
        costoUnit: R(l.precioUnit), saldoPost: nuevoStock,
        referencia: numero, notas: `Recepción ${numero}`,
      },
    });
  }

  if (orden) asientoOCRecibida(prisma, orden, empresaId).catch(() => {});
}

async function siguienteNumero(tx, empresaId) {
  const ultima = await tx.ordenCompra.findFirst({
    where: { empresaId }, orderBy: { id: 'desc' }, select: { numero: true },
  });
  if (!ultima) return 'OC-0001';
  const n = parseInt(ultima.numero.replace('OC-', '')) + 1;
  return `OC-${String(n).padStart(4, '0')}`;
}

function formatearOrden(orden) {
  return {
    ...orden,
    subtotal: R(orden.subtotal), itbms: R(orden.itbms), total: R(orden.total),
    lineas: orden.lineas?.map((l) => ({
      ...l, cantidad: R(l.cantidad), precioUnit: R(l.precioUnit), subtotal: R(l.subtotal),
    })),
    pagos: orden.pagos?.map((p) => ({ ...p, monto: R(p.monto) })),
  };
}

// GET /api/compras
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina  = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite  = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar  = req.query.buscar?.trim() || '';
  const estado  = req.query.estado?.toUpperCase() || '';
  const proveedorId = parseInt(req.query.proveedorId) || null;

  const donde = {
    empresaId,
    ...(estado && { estado }),
    ...(proveedorId && { proveedorId }),
    ...(buscar && {
      OR: [
        { numero: { contains: buscar, mode: 'insensitive' } },
        { proveedor: { nombre: { contains: buscar, mode: 'insensitive' } } },
        { notas: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, ordenes] = await prisma.$transaction([
      prisma.ordenCompra.count({ where: donde }),
      prisma.ordenCompra.findMany({
        where: donde,
        orderBy: { fecha: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true, numero: true, fecha: true, fechaVence: true,
          subtotal: true, itbms: true, total: true, estado: true, notas: true, creadoEn: true,
          proveedor: { select: { id: true, nombre: true, ruc: true } },
        },
      }),
    ]);

    return res.json({
      datos: ordenes.map(formatearOrden),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener órdenes de compra' });
  }
}

// GET /api/compras/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const orden = await prisma.ordenCompra.findFirst({
      where: { id, empresaId },
      include: {
        proveedor: { select: { id: true, nombre: true, ruc: true, email: true } },
        lineas: { include: { producto: { select: { id: true, codigo: true, nombre: true } } } },
        pagos: { orderBy: { fecha: 'asc' } },
      },
    });

    if (!orden) return res.status(404).json({ error: 'Orden de compra no encontrada' });

    const totalPagado    = orden.pagos.reduce((s, p) => s + R(p.monto), 0);
    const saldoPendiente = R(R(orden.total) - totalPagado);

    return res.json({ ...formatearOrden(orden), totalPagado: R(totalPagado), saldoPendiente });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener la orden de compra' });
  }
}

// POST /api/compras
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { proveedorId, fecha, fechaVence, lineas, notas } = req.body;

  if (!proveedorId || !fecha) {
    return res.status(400).json({ error: 'Proveedor y fecha son requeridos' });
  }
  if (!lineas || !Array.isArray(lineas) || lineas.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una línea' });
  }

  for (const [i, l] of lineas.entries()) {
    if (!l.descripcion && !l.productoId) {
      return res.status(400).json({ error: `Línea ${i + 1}: descripción o producto requerido` });
    }
    if (!l.productoId && l.precioUnit === undefined) {
      return res.status(400).json({ error: `Línea ${i + 1}: precioUnit requerido sin producto` });
    }
    const cant = parseFloat(l.cantidad);
    if (isNaN(cant) || cant <= 0) {
      return res.status(400).json({ error: `Línea ${i + 1}: cantidad debe ser mayor a 0` });
    }
  }

  try {
    const orden = await prisma.$transaction(async (tx) => {
      const proveedor = await tx.proveedor.findFirst({
        where: { id: parseInt(proveedorId), empresaId, activo: true },
      });
      if (!proveedor) throw new Error('PROVEEDOR_NO_ENCONTRADO');

      const lineasResueltas = [];
      for (const linea of lineas) {
        let descripcion = linea.descripcion;
        let precioUnit  = parseFloat(linea.precioUnit);
        let aplicaItbms = linea.itbms === true || linea.itbms === 'true';
        let productoId  = linea.productoId ? parseInt(linea.productoId) : null;

        if (productoId) {
          const prod = await tx.producto.findFirst({ where: { id: productoId, empresaId, activo: true } });
          if (!prod) throw new Error(`PRODUCTO_NO_ENCONTRADO:${productoId}`);
          descripcion = descripcion || prod.nombre;
          precioUnit  = isNaN(precioUnit) ? R(prod.precio) : precioUnit;
          aplicaItbms = linea.itbms !== undefined ? aplicaItbms : prod.itbms;
        }

        const cantidad  = parseFloat(linea.cantidad);
        const subtotal  = R(cantidad * precioUnit);
        lineasResueltas.push({ descripcion, productoId, cantidad, precioUnit, itbms: aplicaItbms, subtotal });
      }

      const totalSubtotal = R(lineasResueltas.reduce((s, l) => s + l.subtotal, 0));
      const totalItbms    = R(lineasResueltas.filter((l) => l.itbms).reduce((s, l) => s + R(l.subtotal * TASA_ITBMS), 0));
      const totalFinal    = R(totalSubtotal + totalItbms);
      const numero        = await siguienteNumero(tx, empresaId);

      return await tx.ordenCompra.create({
        data: {
          empresaId, proveedorId: parseInt(proveedorId), numero,
          fecha: new Date(fecha),
          fechaVence: fechaVence ? new Date(fechaVence) : null,
          subtotal: totalSubtotal, itbms: totalItbms, total: totalFinal,
          notas: notas?.trim() || null,
          lineas: { create: lineasResueltas },
        },
        include: {
          proveedor: { select: { id: true, nombre: true, ruc: true } },
          lineas: true,
        },
      });
    });

    return res.status(201).json(formatearOrden(orden));
  } catch (err) {
    if (err.message === 'PROVEEDOR_NO_ENCONTRADO') {
      return res.status(404).json({ error: 'Proveedor no encontrado o inactivo' });
    }
    if (err.message?.startsWith('PRODUCTO_NO_ENCONTRADO')) {
      return res.status(404).json({ error: `Producto id ${err.message.split(':')[1]} no encontrado` });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la orden de compra' });
  }
}

// PATCH /api/compras/:id/estado
async function cambiarEstado(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { estado } = req.body;
  const ESTADOS = ['BORRADOR', 'ENVIADA', 'RECIBIDA', 'ANULADA'];

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!ESTADOS.includes(estado?.toUpperCase())) {
    return res.status(400).json({ error: `Estado debe ser: ${ESTADOS.join(', ')}` });
  }

  try {
    const nuevoEstado = estado.toUpperCase();

    const actualizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({ where: { id, empresaId } });
      if (!orden) throw new Error('ORDEN_NO_ENCONTRADA');
      if (orden.estado === 'ANULADA') throw new Error('ORDEN_ANULADA');

      const updated = await tx.ordenCompra.update({ where: { id }, data: { estado: nuevoEstado } });

      if (nuevoEstado === 'RECIBIDA' && orden.estado !== 'RECIBIDA') {
        await aplicarEntradaInventario(tx, id, orden.numero, empresaId);
      }

      return updated;
    });

    return res.json({ mensaje: `Orden actualizada a ${actualizada.estado}`, estado: actualizada.estado });
  } catch (err) {
    if (err.message === 'ORDEN_NO_ENCONTRADA') return res.status(404).json({ error: 'Orden de compra no encontrada' });
    if (err.message === 'ORDEN_ANULADA') return res.status(409).json({ error: 'Una orden anulada no puede modificarse' });
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar estado' });
  }
}

// POST /api/compras/:id/pagos
async function registrarPago(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { fecha, monto, metodo, referencia, notas } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!fecha || monto === undefined) {
    return res.status(400).json({ error: 'Fecha y monto son requeridos' });
  }
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }
  if (metodo && !METODOS_PAGO.includes(metodo.toUpperCase())) {
    return res.status(400).json({ error: `Método debe ser: ${METODOS_PAGO.join(', ')}` });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({
        where: { id, empresaId }, include: { pagos: true },
      });
      if (!orden) throw new Error('ORDEN_NO_ENCONTRADA');
      if (orden.estado === 'ANULADA') throw new Error('ORDEN_ANULADA');

      const totalPagado    = orden.pagos.reduce((s, p) => s + R(p.monto), 0);
      const saldoPendiente = R(R(orden.total) - totalPagado);

      if (montoNum > saldoPendiente + 0.01) {
        throw new Error(`EXCEDE_SALDO:${saldoPendiente}`);
      }

      const pago = await tx.pagoProveedor.create({
        data: {
          empresaId, ordenCompraId: id,
          fecha: new Date(fecha), monto: montoNum,
          metodo: metodo ? metodo.toUpperCase() : 'TRANSFERENCIA',
          referencia: referencia?.trim() || null,
          notas: notas?.trim() || null,
        },
      });

      const nuevoTotalPagado = R(totalPagado + montoNum);
      const nuevoSaldo       = R(R(orden.total) - nuevoTotalPagado);
      const pagada           = nuevoSaldo <= 0.01;

      if (pagada) {
        await tx.ordenCompra.update({ where: { id }, data: { estado: 'RECIBIDA' } });
        await aplicarEntradaInventario(tx, id, orden.numero, empresaId);
      }

      return { pago, nuevoTotalPagado, nuevoSaldo, estado: pagada ? 'RECIBIDA' : orden.estado, ordenNumero: orden.numero };
    });

    asientoPagoProveedor(prisma, { monto: montoNum, fecha: new Date(fecha), ordenNumero: resultado.ordenNumero }, empresaId).catch(() => {});

    return res.status(201).json({
      mensaje: resultado.estado === 'RECIBIDA'
        ? 'Pago registrado. Orden completamente pagada y marcada como RECIBIDA.'
        : 'Pago registrado correctamente.',
      pago: { ...resultado.pago, monto: R(resultado.pago.monto) },
      totalPagado: resultado.nuevoTotalPagado,
      saldoPendiente: resultado.nuevoSaldo,
      estadoOrden: resultado.estado,
    });
  } catch (err) {
    if (err.message === 'ORDEN_NO_ENCONTRADA') return res.status(404).json({ error: 'Orden no encontrada' });
    if (err.message === 'ORDEN_ANULADA') return res.status(409).json({ error: 'No se puede pagar una orden anulada' });
    if (err.message?.startsWith('EXCEDE_SALDO')) {
      return res.status(409).json({ error: `El monto excede el saldo pendiente de B/. ${err.message.split(':')[1]}` });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar el pago' });
  }
}

module.exports = { listar, obtener, crear, cambiarEstado, registrarPago };
