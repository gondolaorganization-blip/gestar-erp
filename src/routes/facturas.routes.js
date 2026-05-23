const { Router } = require('express');
const { listar, obtener, crear, anular, registrarPago } = require('../controllers/facturas.controller');
const { manejarUpload, listar: listarAdj, subir, descargar, eliminar } = require('../controllers/adjuntos.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { generarFacturaPDF } = require('../services/pdf.service');
const { enviarFactura } = require('../services/email.service');
const prisma = require('../config/prisma');

const router = Router();
router.use(verificarToken);

router.get('/',              listar);
router.get('/:id',           obtener);
router.post('/',             crear);
router.patch('/:id/anular',  anular);
router.post('/:id/pagos',    registrarPago);

// Adjuntos
router.get( '/:referenciaId/adjuntos',          (req, res) => { req.params.tipo = 'FACTURA'; listarAdj(req, res); });
router.post('/:referenciaId/adjuntos',          manejarUpload, (req, res) => { req.params.tipo = 'FACTURA'; subir(req, res); });
router.get( '/adjuntos/:id/descargar',          descargar);
router.delete('/adjuntos/:id',                  eliminar);

// GET /api/facturas/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const [factura, empresa] = await Promise.all([
      prisma.factura.findFirst({
        where: { id, empresaId },
        include: {
          cliente: { select: { nombre: true, tipoDoc: true, numDoc: true, email: true } },
          lineas: true,
        },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId } }),
    ]);

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const pdf = await generarFacturaPDF(factura, empresa);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${factura.numero}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// POST /api/facturas/:id/enviar  — reenvía la factura por email al cliente
router.post('/:id/enviar', async (req, res) => {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const [factura, empresa] = await Promise.all([
      prisma.factura.findFirst({
        where: { id, empresaId },
        include: { cliente: { select: { nombre: true, email: true } } },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId } }),
    ]);

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    if (!factura.cliente?.email) return res.status(400).json({ error: 'El cliente no tiene email registrado' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    await enviarFactura({
      clienteEmail:  factura.cliente.email,
      clienteNombre: factura.cliente.nombre,
      numeroFactura: factura.numero,
      total:         Number(factura.total),
      empresaNombre: empresa.nombre,
      enlacePDF:     `${frontendUrl}/api/facturas/${factura.id}/pdf`,
    });

    return res.json({ mensaje: `Factura enviada a ${factura.cliente.email}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al enviar el correo' });
  }
});

module.exports = router;
