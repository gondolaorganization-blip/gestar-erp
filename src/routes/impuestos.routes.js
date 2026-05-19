const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/impuestos.controller');

router.use(verificarToken);
router.get('/', ctrl.obtener);

module.exports = router;
