const { Router } = require('express');
const { listar, crear } = require('../controllers/empresas.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();
router.use(verificarToken);

router.get('/',  listar);
router.post('/', crear);

module.exports = router;
