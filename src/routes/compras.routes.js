const { Router } = require('express');
const { listar, obtener, crear, cambiarEstado, registrarPago } = require('../controllers/compras.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { generarOrdenCompraPDF } = require('../services/pdf.service');
const { enviarOrdenCompra }     = require('../services/email.service');
const prisma = require('../config/prisma');

const router = Router();
router.use(verificarToken);

router.get('/',                  listar);
router.get('/:id',               obtener);
router.post('/',                 crear);
router.patch('/:id/estado',      cambiarEstado);
router.post('/:id/pagos',        registrarPago);

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
