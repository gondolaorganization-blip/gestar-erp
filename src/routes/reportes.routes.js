const { Router } = require('express');
const { balanceGeneral, estadoResultados, libroDiario, antiguedadCartera } = require('../controllers/reportes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { generarBalancePDF, generarEstadoResultadosPDF, generarLibroDiarioPDF, generarCarteraPDF } = require('../services/pdf.service');
const prisma = require('../config/prisma');

const router = Router();
router.use(verificarToken);

router.get('/balance-general',    balanceGeneral);
router.get('/estado-resultados',  estadoResultados);
router.get('/libro-diario',       libroDiario);
router.get('/antiguedad-cartera', antiguedadCartera);

// GET /api/reportes/balance-general/pdf?al=YYYY-MM-DD
router.get('/balance-general/pdf', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await balanceGeneral(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte.error) return res.status(500).json(reporte);

    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const pdf = await generarBalancePDF(reporte, empresa);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="balance-${reporte.al}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/reportes/estado-resultados/pdf?desde=...&hasta=...
router.get('/estado-resultados/pdf', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await estadoResultados(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte.error) return res.status(500).json(reporte);

    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const pdf = await generarEstadoResultadosPDF(reporte, empresa);

    const nombre = `estado-resultados-${reporte.periodo.desde}-${reporte.periodo.hasta}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/reportes/libro-diario/pdf?desde=...&hasta=...
router.get('/libro-diario/pdf', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await libroDiario(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte?.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const pdf = await generarLibroDiarioPDF(reporte, empresa);
    const { desde, hasta } = req.query;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="libro-diario-${desde ?? ''}-${hasta ?? ''}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/reportes/antiguedad-cartera/pdf
router.get('/antiguedad-cartera/pdf', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await antiguedadCartera(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte?.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const pdf = await generarCarteraPDF(reporte, empresa);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cartera-${new Date().toISOString().slice(0,10)}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

module.exports = router;
