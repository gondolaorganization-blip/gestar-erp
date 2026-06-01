const express = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { getPlanes, activarSuscripcion, cancelarSuscripcion, webhook } = require('../controllers/paypal.controller');

const router = express.Router();

router.get('/planes',  getPlanes);
router.post('/webhook', webhook);
router.post('/activar',  verificarToken, activarSuscripcion);
router.post('/cancelar', verificarToken, cancelarSuscripcion);

module.exports = router;
