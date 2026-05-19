const { Router } = require('express');
const { listar, obtener, crear, cambiarEstado, actualizarLinea, enviarComprobantes, preview } = require('../controllers/nomina.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/preview',                        preview);
router.get('/',                               listar);
router.get('/:id',                            obtener);
router.post('/',                              crear);
router.patch('/:id/estado',                   cambiarEstado);
router.patch('/:periodoId/lineas/:lineaId',   actualizarLinea);
router.post('/:id/comprobantes',              enviarComprobantes);

module.exports = router;
