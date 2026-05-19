const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { listar, crear, actualizar, eliminar } = require('../controllers/contactos.controller');

const router = Router();
router.use(verificarToken);

router.get('/',     listar);
router.post('/',    crear);
router.put('/:id',  actualizar);
router.delete('/:id', eliminar);

module.exports = router;
