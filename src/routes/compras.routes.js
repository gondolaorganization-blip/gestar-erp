const { Router } = require('express');
const { listar, obtener, crear, cambiarEstado, registrarPago } = require('../controllers/compras.controller');
const { manejarUpload, listar: listarAdj, subir, descargar, eliminar } = require('../controllers/adjuntos.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { generarOrdenCompraPDF } = require('../services/pdf.service');
const { generarComprasExcel }   = require('../services/excel.service');
const { enviarOrdenCompra }     = require('../services/email.service');
const prisma = require('../config/prisma');

const router = Router();
router.use(verificarToken);

router.get('/',                  listar);
router.get('/:id',               obtener);
router.post('/',                 crear);
router.patch('/:id/estado',      cambiarEstado);
router.post('/:id/pagos',        registrarPago);

// GET /api/compras/exportar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=RECIBIDA
router.get('/exportar', async (req, res) => {
  const { empresaId } = req.usuario;
  const { desde, hasta, estado } = req.query;
  try {
    const where = { empresaId };
    if (estado) where.estado = estado;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }
    const ordenes = await prisma.ordenCompra.findMany({
      where,
      include: { proveedor: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    });
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    const buf = generarComprasExcel(ordenes, empresa);
    const nombre = `compras-${desde ?? ''}${hasta ? `-${hasta}` : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al exportar compras' });
  }
});

// Adjuntos
router.get( '/:referenciaId/adjuntos',    (req, res) => { req.params.tipo = 'ORDEN_COMPRA'; listarAdj(req, res); });
router.post('/:referenciaId/adjuntos',    manejarUpload, (req, res) => { req.params.tipo = 'ORDEN_COMPRA'; subir(req, res); });
router.get( '/adjuntos/:id/descargar',    descargar);
router.delete('/adjuntos/:id',            eliminar);

// GET /api/compras/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [orden, empresa] = await Promise.all([
      prisma.ordenCompra.findFirst({
        where: { id, empresaId },
        include: {
          proveedor: { select: { nombre: true, ruc: true, email: true } },
          lineas: true,
        },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId } }),
    ]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    const pdf = await generarOrdenCompraPDF(orden, empresa);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="oc-${orden.numero}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// POST /api/compras/:id/enviar
router.post('/:id/enviar', async (req, res) => {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [orden, empresa] = await Promise.all([
      prisma.ordenCompra.findFirst({
        where: { id, empresaId },
        include: { proveedor: { select: { nombre: true, email: true } } },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId } }),
    ]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!orden.proveedor?.email) return res.status(400).json({ error: 'El proveedor no tiene email registrado' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    await enviarOrdenCompra({
      proveedorEmail:  orden.proveedor.email,
      proveedorNombre: orden.proveedor.nombre,
      numeroOC:        orden.numero,
      total:           Number(orden.total),
      empresaNombre:   empresa.nombre,
      enlacePDF:       `${frontendUrl}/api/compras/${orden.id}/pdf`,
    });

    return res.json({ mensaje: `Orden enviada a ${orden.proveedor.email}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al enviar el correo' });
  }
});

module.exports = router;
