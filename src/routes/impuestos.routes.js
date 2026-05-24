const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/impuestos.controller');
const { generarITBMSPDF, generarISRPDF, generarCSSPDF } = require('../services/pdf.service');
const { generarITBMSExcel, generarISRExcel, generarCSSExcel } = require('../services/excel.service');
const prisma = require('../config/prisma');

router.use(verificarToken);
router.get('/', ctrl.obtener);

// Helper: obtener datos de impuestos para el año dado
async function getDatosImpuestos(req) {
  const fakeRes = { _data: null, json(d) { this._data = d; return this; } };
  await ctrl.obtener(req, fakeRes);
  return fakeRes._data;
}

async function getEmpresa(empresaId) {
  return prisma.empresa.findUnique({ where: { id: empresaId } });
}

// GET /api/impuestos/itbms/pdf?anio=2025
router.get('/itbms/pdf', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const pdf = await generarITBMSPDF(datos.itbms, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="itbms-${datos.anio}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/impuestos/itbms/excel?anio=2025
router.get('/itbms/excel', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const buf = generarITBMSExcel(datos.itbms, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="itbms-${datos.anio}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// GET /api/impuestos/isr/pdf?anio=2025
router.get('/isr/pdf', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const pdf = await generarISRPDF(datos.isr, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="isr-${datos.anio}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/impuestos/css/pdf?anio=2025
router.get('/css/pdf', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const pdf = await generarCSSPDF(datos.css, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="css-sea-${datos.anio}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// GET /api/impuestos/isr/excel?anio=2025
router.get('/isr/excel', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const buf = generarISRExcel(datos.isr, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="isr-${datos.anio}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// GET /api/impuestos/css/excel?anio=2025
router.get('/css/excel', async (req, res) => {
  try {
    const datos   = await getDatosImpuestos(req);
    const empresa = await getEmpresa(req.usuario.empresaId);
    const buf = generarCSSExcel(datos.css, empresa, datos.anio);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="css-sea-${datos.anio}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

module.exports = router;
