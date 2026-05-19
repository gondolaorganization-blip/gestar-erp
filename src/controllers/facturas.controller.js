const prisma = require('../config/prisma');
const { enviarFactura } = require('../services/email.service');
const { asientoFacturaCreada, asientoCobroFactura } = require('../services/contabilidad.service');

const TASA_ITBMS = 0.07;
const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADA', 'ANULADA', 'VENCIDA'];
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function siguienteNumero(tx, empresaId) {
  const ultima = await tx.factura.findFirst({
    where: { empresaId },
    orderBy: { id: 'desc' },
    select: { numero: true },
  });
  if (!ultima) return 'F-0001';
  const n = parseInt(ultima.numero.replace('F-', '')) + 1;
  return `F-${String(n).padStart(4, '0')}`;
}

function calcularLinea(linea) {
  const subtotal = Number((linea.cantidad * linea.precioUnit).toFixed(2));
  const montoItbms = linea.itbms ? Number((subtotal * TASA_ITBMS).toFixed(2)) : 0;
  return { subtotal, montoItbms };
}

function formatearFactura(factura) {
  return {
    ...factura,
    subtotal: Number(factura.subtotal),
    itbms: Number(factura.itbms),
    total: Number(factura.total),
    lineas: factura.lineas?.map((l) => ({
      ...l,
      cantidad: Number(l.cantidad),
      precioUnit: Number(l.precioUnit),
      subtotal: Number(l.subtotal),
    })),
    pagos: factura.pagos?.map((p) => ({
      ...p,
      monto: Number(p.monto),
    })),
  };
}

// ─── LISTAR ──────────────────────────────────────────────────────────────────

async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const estado = req.query.estado?.toUpperCase() || '';
  const clienteId = parseInt(req.query.clienteId) || null;

  // Marcar como vencidas automáticamente antes de listar
  await prisma.factura.updateMany({
    where: {
      empresaId,
      estado: 'PENDIENTE',
      fechaVence: { lt: new Date() },
    },
    data: { estado: 'VENCIDA' },
  });

  const donde = {
    empresaId,
    ...(estado && ESTADOS_VALIDOS.includes(estado) && { estado }),
    ...(clienteId && { clienteId }),
    ...(buscar && {
      OR: [
        { numero: { contains: buscar, mode: 'insensitive' } },
        { cliente: { nombre: { contains: buscar, mode: 'insensitive' } } },
        { notas: { contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, facturas] = await prisma.$transaction([
      prisma.factura.count({ where: donde }),
      prisma.factura.findMany({
        where: donde,
        orderBy: { fecha: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          numero: true,
          fecha: true,
          fechaVence: true,
          subtotal: true,
          itbms: true,
          total: true,
          estado: true,
          notas: true,
          creadoEn: true,
          cliente: { select: { id: true, nombre: true, tipoDoc: true, numDoc: true } },
        },
      }),
    ]);

    return res.json({
      datos: facturas.map(formatearFactura),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener facturas' });
  }
}

// ─── OBTENER ─────────────────────────────────────────────────────────────────

async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const factura = await prisma.factura.findFirst({
      where: { id, empresaId },
      include: {
        cliente: { select: { id: true, nombre: true, tipoDoc: true, numDoc: true, email: true } },
        lineas: {
          include: { producto: { select: { id: true, codigo: true, nombre: true } } },
        },
        pagos: { orderBy: { fecha: 'asc' } },
      },
    });

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const totalPagado = factura.pagos.reduce((s, p) => s + Number(p.monto), 0);
    const saldoPendiente = Number((Number(factura.total) - totalPagado).toFixed(2));

    return res.json({ ...formatearFactura(factura), totalPagado, saldoPendiente });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener la factura' });
  }
}

// ─── CREAR ───────────────────────────────────────────────────────────────────

async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { clienteId, fecha, fechaVence, lineas, notas } = req.body;

  if (!clienteId || !lineas || !Array.isArray(lineas) || lineas.length === 0) {
    return res.status(400).json({ error: 'Cliente y al menos una línea son requeridos' });
  }
  if (!fecha) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  // Validar cada línea antes de abrir transacción
  for (const [i, linea] of lineas.entries()) {
    if (!linea.descripcion && !linea.productoId) {
      return res.status(400).json({ error: `Línea ${i + 1}: descripción o producto es requerido` });
    }
    const cant = parseFloat(linea.cantidad);
    if (isNaN(cant) || cant <= 0) {
      return res.status(400).json({ error: `Línea ${i + 1}: cantidad debe ser mayor a 0` });
    }
    // precioUnit solo es obligatorio cuando no viene productoId
    if (!linea.productoId && linea.precioUnit !== undefined) {
      const precio = parseFloat(linea.precioUnit);
      if (isNaN(precio) || precio < 0) {
        return res.status(400).json({ error: `Línea ${i + 1}: precio unitario inválido` });
      }
    }
    if (!linea.productoId && linea.precioUnit === undefined) {
      return res.status(400).json({ error: `Línea ${i + 1}: precio unitario es requerido cuando no se especifica producto` });
    }
  }

  try {
    const factura = await prisma.$transaction(async (tx) => {
      // Verificar cliente
      const cliente = await tx.cliente.findFirst({
        where: { id: parseInt(clienteId), empresaId, activo: true },
      });
      if (!cliente) throw new Error('CLIENTE_NO_ENCONTRADO');

      // Resolver líneas (si vienen con productoId, tomar precio del producto)
      const lineasResueltas = [];
      for (const linea of lineas) {
        let descripcion = linea.descripcion;
        let precioUnit = parseFloat(linea.precioUnit);
        let aplicaItbms = linea.itbms === true || linea.itbms === 'true';
        let productoId = linea.productoId ? parseInt(linea.productoId) : null;

        if (productoId) {
          const producto = await tx.producto.findFirst({
            where: { id: productoId, empresaId, activo: true },
          });
          if (!producto) throw new Error(`PRODUCTO_NO_ENCONTRADO:${productoId}`);
          descripcion = descripcion || producto.nombre;
          precioUnit = isNaN(precioUnit) ? Number(producto.precio) : precioUnit;
          aplicaItbms = linea.itbms !== undefined ? aplicaItbms : producto.itbms;
        }

        const cantidad = parseFloat(linea.cantidad);
        const { subtotal } = calcularLinea({ cantidad, precioUnit, itbms: aplicaItbms });

        lineasResueltas.push({ descripcion, productoId, cantidad, precioUnit, itbms: aplicaItbms, subtotal });
      }

      // Calcular totales
      let totalSubtotal = 0;
      let totalItbms = 0;
      for (const l of lineasResueltas) {
        totalSubtotal += l.subtotal;
        if (l.itbms) totalItbms += Number((l.subtotal * TASA_ITBMS).toFixed(2));
      }
      totalSubtotal = Number(totalSubtotal.toFixed(2));
      totalItbms = Number(totalItbms.toFixed(2));
      const totalFinal = Number((totalSubtotal + totalItbms).toFixed(2));

      const numero = await siguienteNumero(tx, empresaId);

      const factura = await tx.factura.create({
        data: {
          empresaId,
          clienteId: parseInt(clienteId),
          numero,
          fecha: new Date(fecha),
          fechaVence: fechaVence ? new Date(fechaVence) : null,
          subtotal: totalSubtotal,
          itbms: totalItbms,
          total: totalFinal,
          notas: notas?.trim() || null,
          lineas: {
            create: lineasResueltas.map((l) => ({
              productoId: l.productoId,
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              precioUnit: l.precioUnit,
              itbms: l.itbms,
              subtotal: l.subtotal,
            })),
          },
        },
        include: {
          cliente: { select: { id: true, nombre: true, tipoDoc: true, numDoc: true } },
          lineas: true,
        },
      });

      // Registrar salidas de inventario para productos
      for (const l of lineasResueltas) {
        if (!l.productoId) continue;
        const prod = await tx.producto.findUnique({ where: { id: l.productoId }, select: { stock: true } });
        const nuevoStock = Number((Number(prod?.stock ?? 0) - l.cantidad).toFixed(4));
        await tx.producto.update({ where: { id: l.productoId }, data: { stock: nuevoStock } });
        await tx.movimientoInventario.create({
          data: {
            empresaId, productoId: l.productoId,
            tipo: 'SALIDA', cantidad: l.cantidad,
            costoUnit: l.precioUnit, saldoPost: nuevoStock,
            referencia: numero, notas: `Venta ${numero}`,
          },
        });
      }

      return factura;
    });

    // Asiento contable (fuera de la tx para no interferir con operaciones del inventario)
    asientoFacturaCreada(prisma, factura, empresaId).catch(() => {});

    // Notificar al cliente por email si tiene correo registrado (falla silencioso)
    if (factura.cliente?.email) {
      const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const enlacePDF   = `${frontendUrl}/api/facturas/${factura.id}/pdf`;
      enviarFactura({
        clienteEmail:  factura.cliente.email,
        clienteNombre: factura.cliente.nombre,
        numeroFactura: factura.numero,
        total:         factura.total,
        empresaNombre: empresa?.nombre ?? 'tu proveedor',
        enlacePDF,
      }).catch(() => {});
    }

    return res.status(201).json(formatearFactura(factura));
  } catch (err) {
    if (err.message === 'CLIENTE_NO_ENCONTRADO') {
      return res.status(404).json({ error: 'Cliente no encontrado o inactivo' });
    }
    if (err.message?.startsWith('PRODUCTO_NO_ENCONTRADO')) {
      const id = err.message.split(':')[1];
      return res.status(404).json({ error: `Producto con id ${id} no encontrado o inactivo` });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la factura' });
  }
}

// ─── ANULAR ──────────────────────────────────────────────────────────────────

async function anular(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const factura = await prisma.factura.findFirst({ where: { id, empresaId } });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    if (factura.estado === 'ANULADA') {
      return res.status(409).json({ error: 'La factura ya está anulada' });
    }
    if (factura.estado === 'PAGADA') {
      return res.status(409).json({ error: 'No se puede anular una factura pagada' });
    }

    const actualizada = await prisma.factura.update({
      where: { id },
      data: { estado: 'ANULADA' },
    });

    return res.json({ mensaje: 'Factura anulada correctamente', estado: actualizada.estado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al anular la factura' });
  }
}

// ─── REGISTRAR PAGO ──────────────────────────────────────────────────────────

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
      const factura = await tx.factura.findFirst({
        where: { id, empresaId },
        include: { pagos: true },
      });
      if (!factura) throw new Error('FACTURA_NO_ENCONTRADA');
      if (factura.estado === 'ANULADA') throw new Error('FACTURA_ANULADA');

      const totalPagado = factura.pagos.reduce((s, p) => s + Number(p.monto), 0);
      const saldoPendiente = Number((Number(factura.total) - totalPagado).toFixed(2));

      if (montoNum > saldoPendiente + 0.01) {
        throw new Error(`EXCEDE_SALDO:${saldoPendiente}`);
      }

      const pago = await tx.pago.create({
        data: {
          empresaId,
          facturaId: id,
          fecha: new Date(fecha),
          monto: montoNum,
          metodo: metodo ? metodo.toUpperCase() : 'EFECTIVO',
          referencia: referencia?.trim() || null,
          notas: notas?.trim() || null,
        },
      });

      const nuevoTotalPagado = Number((totalPagado + montoNum).toFixed(2));
      const nuevoSaldo = Number((Number(factura.total) - nuevoTotalPagado).toFixed(2));
      const completamentePagada = nuevoSaldo <= 0.01;

      if (completamentePagada) {
        await tx.factura.update({ where: { id }, data: { estado: 'PAGADA' } });
      }

      return { pago, nuevoTotalPagado, nuevoSaldo, estadoFactura: completamentePagada ? 'PAGADA' : factura.estado, facturaNumero: factura.numero };
    });

    asientoCobroFactura(prisma, { monto: montoNum, fecha: new Date(fecha), facturaNumero: resultado.facturaNumero }, empresaId).catch(() => {});

    return res.status(201).json({
      mensaje: resultado.estadoFactura === 'PAGADA'
        ? 'Pago registrado. Factura pagada completamente.'
        : 'Pago registrado correctamente.',
      pago: { ...resultado.pago, monto: Number(resultado.pago.monto) },
      totalPagado: resultado.nuevoTotalPagado,
      saldoPendiente: resultado.nuevoSaldo,
      estadoFactura: resultado.estadoFactura,
    });
  } catch (err) {
    if (err.message === 'FACTURA_NO_ENCONTRADA') {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (err.message === 'FACTURA_ANULADA') {
      return res.status(409).json({ error: 'No se puede registrar un pago en una factura anulada' });
    }
    if (err.message?.startsWith('EXCEDE_SALDO')) {
      const saldo = err.message.split(':')[1];
      return res.status(409).json({ error: `El monto excede el saldo pendiente de B/. ${saldo}` });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar el pago' });
  }
}

module.exports = { listar, obtener, crear, anular, registrarPago };
