const { Router } = require('express');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/leads.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();
router.use(verificarToken);

router.get('/',     listar);
router.get('/:id',  obtener);
router.post('/',    crear);
router.put('/:id',  actualizar);
router.delete('/:id', eliminar);

module.exports = router;
