const { Router } = require('express');
const { resumen } = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();
router.use(verificarToken);

router.get('/', resumen);

module.exports = router;
