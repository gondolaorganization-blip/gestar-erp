const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin }      = require('../middlewares/admin.middleware');
const { descargar }      = require('../controllers/backup.controller');

router.use(verificarToken);
router.get('/', soloAdmin, descargar);

module.exports = router;
