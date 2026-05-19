const XLSX  = require('xlsx');
const prisma = require('../config/prisma');

const fmt = (v) => (v == null ? '' : v);
const fmtFecha = (v) => (v ? new Date(v).toLocaleDateString('es-PA') : '');
const fmtNum = (v) => (v == null ? '' : Number(v));

async function descargar(req, res) {
  const { empresaId } = req.usuario;

  try {
    const [
      clientes, proveedores, productos,
      facturas, lineasFactura, pagos,
      compras, lineasCompra, pagosProveedor,
      empleados, periodos, lineasNomina,
      usuarios,
    ] = await Promise.all([
      prisma.cliente.findMany({ where: { empresaId }, orderBy: { id: 'asc' } }),
      prisma.proveedor.findMany({ where: { empresaId }, orderBy: { id: 'asc' } }),
      prisma.producto.findMany({ where: { empresaId }, orderBy: { id: 'asc' } }),

      prisma.factura.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { cliente: { select: { nombre: true } } },
      }),
      prisma.lineaFactura.findMany({
        where: { factura: { empresaId } }, orderBy: { id: 'asc' },
        include: { factura: { select: { numero: true } } },
      }),
      prisma.pago.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { factura: { select: { numero: true } } },
      }),

      prisma.ordenCompra.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { proveedor: { select: { nombre: true } } },
      }),
      prisma.lineaOrdenCompra.findMany({
        where: { ordenCompra: { empresaId } }, orderBy: { id: 'asc' },
        include: { ordenCompra: { select: { numero: true } } },
      }),
      prisma.pagoProveedor.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { ordenCompra: { select: { numero: true } } },
      }),

      prisma.empleado.findMany({ where: { empresaId }, orderBy: { id: 'asc' } }),
      prisma.periodoNomina.findMany({ where: { empresaId }, orderBy: { id: 'asc' } }),
      prisma.lineaNomina.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { empleado: { select: { nombre: true } }, periodo: { select: { numero: true } } },
      }),

      prisma.usuario.findMany({
        where: { empresaId }, orderBy: { id: 'asc' },
        include: { rol: { select: { nombre: true } } },
      }),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Clientes ──────────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes.map((c) => ({
      ID: c.id, Nombre: fmt(c.nombre), 'Tipo Doc': fmt(c.tipoDoc),
      Documento: fmt(c.numDoc), Email: fmt(c.email), Teléfono: fmt(c.telefono),
      Dirección: fmt(c.direccion), Creado: fmtFecha(c.createdAt),
    }))), 'Clientes');

    // ── Proveedores ───────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proveedores.map((p) => ({
      ID: p.id, Nombre: fmt(p.nombre), RUC: fmt(p.ruc),
      Email: fmt(p.email), Teléfono: fmt(p.telefono), Dirección: fmt(p.direccion),
    }))), 'Proveedores');

    // ── Productos ─────────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos.map((p) => ({
      ID: p.id, Código: fmt(p.codigo), Nombre: fmt(p.nombre),
      Descripción: fmt(p.descripcion), Precio: fmtNum(p.precio),
      ITBMS: fmtNum(p.itbms), Stock: fmtNum(p.stock),
    }))), 'Productos');

    // ── Facturas ──────────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facturas.map((f) => ({
      ID: f.id, Número: fmt(f.numero), Fecha: fmtFecha(f.fecha),
      Cliente: fmt(f.cliente?.nombre), Estado: fmt(f.estado),
      Subtotal: fmtNum(f.subtotal), ITBMS: fmtNum(f.itbms), Total: fmtNum(f.total),
      'Saldo pendiente': fmtNum(f.saldoPendiente),
    }))), 'Facturas');

    // ── Líneas de factura ─────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineasFactura.map((l) => ({
      'Factura N°': fmt(l.factura?.numero), Descripción: fmt(l.descripcion),
      Cantidad: fmtNum(l.cantidad), 'Precio unitario': fmtNum(l.precioUnitario),
      ITBMS: fmtNum(l.itbms), Total: fmtNum(l.total),
    }))), 'Líneas Factura');

    // ── Cobros (pagos de facturas) ────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagos.map((p) => ({
      'Factura N°': fmt(p.factura?.numero), Fecha: fmtFecha(p.fecha),
      Monto: fmtNum(p.monto), Método: fmt(p.metodo), Referencia: fmt(p.referencia),
    }))), 'Cobros');

    // ── Órdenes de compra ─────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.map((c) => ({
      ID: c.id, Número: fmt(c.numero), Fecha: fmtFecha(c.fecha),
      Proveedor: fmt(c.proveedor?.nombre), Estado: fmt(c.estado),
      Subtotal: fmtNum(c.subtotal), ITBMS: fmtNum(c.itbms), Total: fmtNum(c.total),
    }))), 'Órdenes Compra');

    // ── Líneas de compra ──────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineasCompra.map((l) => ({
      'Orden N°': fmt(l.ordenCompra?.numero), Descripción: fmt(l.descripcion),
      Cantidad: fmtNum(l.cantidad), 'Precio unitario': fmtNum(l.precioUnitario),
      ITBMS: fmtNum(l.itbms), Total: fmtNum(l.total),
    }))), 'Líneas Compra');

    // ── Pagos a proveedores ───────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagosProveedor.map((p) => ({
      'Orden N°': fmt(p.ordenCompra?.numero), Fecha: fmtFecha(p.fecha),
      Monto: fmtNum(p.monto), Método: fmt(p.metodo), Referencia: fmt(p.referencia),
    }))), 'Pagos Proveedor');

    // ── Empleados ─────────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empleados.map((e) => ({
      ID: e.id, Nombre: fmt(e.nombre), Cédula: fmt(e.cedula),
      Cargo: fmt(e.cargo), 'Salario base': fmtNum(e.salarioBase),
      'Fecha ingreso': fmtFecha(e.fechaIngreso), Activo: e.activo ? 'Sí' : 'No',
    }))), 'Empleados');

    // ── Períodos de nómina ────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(periodos.map((p) => ({
      'N°': fmt(p.numero), 'Fecha inicio': fmtFecha(p.fechaInicio),
      'Fecha fin': fmtFecha(p.fechaFin), Estado: fmt(p.estado),
      'Total bruto': fmtNum(p.totalBruto), 'Total neto': fmtNum(p.totalNeto),
      'Total patrono': fmtNum(p.totalPatrono),
    }))), 'Períodos Nómina');

    // ── Líneas de nómina ──────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineasNomina.map((l) => ({
      'Período N°': fmt(l.periodo?.numero), Empleado: fmt(l.empleado?.nombre),
      'Salario bruto': fmtNum(l.salarioBruto), 'CSS empleado': fmtNum(l.cssEmpleado),
      'SEA empleado': fmtNum(l.seaEmpleado), ISR: fmtNum(l.isr),
      'Salario neto': fmtNum(l.salarioNeto), 'CSS patrono': fmtNum(l.cssPatrono),
      'SEA patrono': fmtNum(l.seaPatrono),
    }))), 'Líneas Nómina');

    // ── Usuarios ──────────────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usuarios.map((u) => ({
      ID: u.id, Nombre: fmt(u.nombre), Email: fmt(u.email),
      Rol: fmt(u.rol?.nombre), Activo: u.activo ? 'Sí' : 'No',
      'Último acceso': fmtFecha(u.ultimoAcceso),
    }))), 'Usuarios');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fecha  = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="backup-gestar-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el backup' });
  }
}

module.exports = { descargar };
