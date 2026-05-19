const { Router } = require('express');
const { listar, obtener, crear, actualizar, cambiarEtapa, eliminar } = require('../controllers/oportunidades.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();
router.use(verificarToken);

router.get('/',              listar);
router.get('/:id',           obtener);
router.post('/',             crear);
router.put('/:id',           actualizar);
router.patch('/:id/etapa',   cambiarEtapa);
router.delete('/:id',        eliminar);

module.exports = router;
