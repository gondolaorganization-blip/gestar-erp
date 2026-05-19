require('dotenv').config();
const prisma = require('../config/prisma');

// Limpia todas las tablas en orden inverso de dependencias antes de cada suite
async function limpiarBD() {
  await prisma.$transaction([
    prisma.lineaNomina.deleteMany(),
    prisma.actividadCRM.deleteMany(),
    prisma.oportunidadVenta.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.contacto.deleteMany(),
    prisma.entidad.deleteMany(),
    prisma.periodoNomina.deleteMany(),
    prisma.empleado.deleteMany(),
    prisma.movimientoInventario.deleteMany(),
    prisma.pagoProveedor.deleteMany(),
    prisma.lineaOrdenCompra.deleteMany(),
    prisma.ordenCompra.deleteMany(),
    prisma.pago.deleteMany(),
    prisma.lineaFactura.deleteMany(),
    prisma.factura.deleteMany(),
    prisma.lineaAsiento.deleteMany(),
    prisma.asiento.deleteMany(),
    prisma.cuentaContable.deleteMany(),
    prisma.producto.deleteMany(),
    prisma.proveedor.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.rol.deleteMany(),
    prisma.empresa.deleteMany(),
  ]);
}

async function cerrarBD() {
  await prisma.$disconnect();
}

module.exports = { limpiarBD, cerrarBD, prisma };
