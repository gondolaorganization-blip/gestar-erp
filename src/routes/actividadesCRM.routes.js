const { Router } = require('express');
const { listar, crear, completar, eliminar } = require('../controllers/actividadesCRM.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();
router.use(verificarToken);

router.get('/',                  listar);
router.post('/',                 crear);
router.patch('/:id/completar',   completar);
router.delete('/:id',            eliminar);

module.exports = router;
