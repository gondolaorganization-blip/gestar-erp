const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');

const {
  listar: listarCuentas,
  obtener: obtenerCuenta,
  crear: crearCuenta,
  actualizar: actualizarCuenta,
  semilla,
} = require('../controllers/cuentas.controller');

const {
  listar: listarAsientos,
  obtener: obtenerAsiento,
  crear: crearAsiento,
  aprobar,
  anular,
} = require('../controllers/asientos.controller');

const router = Router();
router.use(verificarToken);

// ─── Plan de cuentas ─────────────────────────────────────────────────────────
router.get('/cuentas',          listarCuentas);
router.get('/cuentas/:id',      obtenerCuenta);
router.post('/cuentas',         crearCuenta);
router.put('/cuentas/:id',      actualizarCuenta);
router.post('/cuentas/semilla', semilla);

// ─── Asientos ────────────────────────────────────────────────────────────────
router.get('/asientos',                listarAsientos);
router.get('/asientos/:id',            obtenerAsiento);
router.post('/asientos',               crearAsiento);
router.patch('/asientos/:id/aprobar',  aprobar);
router.patch('/asientos/:id/anular',   anular);

module.exports = router;
