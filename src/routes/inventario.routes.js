const { Router } = require('express');
const { listar, obtener, registrarMovimiento, actualizarMinimo } = require('../controllers/inventario.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/:id/movimiento', registrarMovimiento);
router.patch('/:id/minimo', actualizarMinimo);

module.exports = router;
