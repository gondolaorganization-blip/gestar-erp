const { Router } = require('express');
const { balanceGeneral, estadoResultados, libroDiario, antiguedadCartera } = require('../controllers/reportes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { generarBalancePDF, generarEstadoResultadosPDF, generarLibroDiarioPDF, generarCarteraPDF } = require('../services/pdf.service');
const { generarBalanceExcel, generarEstadoResultadosExcel, generarLibroDiarioExcel, generarCarteraExcel } = require('../services/excel.service');
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

// GET /api/reportes/balance-general/excel?al=YYYY-MM-DD
router.get('/balance-general/excel', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await balanceGeneral(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const buf = generarBalanceExcel(reporte, empresa);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="balance-${reporte.al}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// GET /api/reportes/estado-resultados/excel?desde=...&hasta=...
router.get('/estado-resultados/excel', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await estadoResultados(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const buf = generarEstadoResultadosExcel(reporte, empresa);
    const { desde, hasta } = req.query;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="estado-resultados-${desde ?? ''}-${hasta ?? ''}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// GET /api/reportes/libro-diario/excel?desde=...&hasta=...
router.get('/libro-diario/excel', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await libroDiario(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte?.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const buf = generarLibroDiarioExcel(reporte, empresa);
    const { desde, hasta } = req.query;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="libro-diario-${desde ?? ''}-${hasta ?? ''}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// GET /api/reportes/antiguedad-cartera/excel
router.get('/antiguedad-cartera/excel', async (req, res) => {
  try {
    const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
    await antiguedadCartera(req, fakeRes);
    const reporte = fakeRes._data;
    if (reporte?.error) return res.status(500).json(reporte);
    const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
    const buf = generarCarteraExcel(reporte, empresa);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cartera-${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

module.exports = router;
