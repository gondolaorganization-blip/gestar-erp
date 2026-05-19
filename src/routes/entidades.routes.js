const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { listar, obtener, crear, actualizar, eliminar, convertirACliente } = require('../controllers/entidades.controller');

const router = Router();
router.use(verificarToken);

router.get('/',                    listar);
router.get('/:id',                 obtener);
router.post('/',                   crear);
router.put('/:id',                 actualizar);
router.delete('/:id',              eliminar);
router.post('/:id/convertir',      convertirACliente);

module.exports = router;
