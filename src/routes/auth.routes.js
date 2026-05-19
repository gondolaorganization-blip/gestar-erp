const { Router } = require('express');
const { registro, login, perfil, recuperar, resetPassword } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/registro',        registro);
router.post('/login',           login);
router.get('/me',               verificarToken, perfil);
router.post('/recuperar',       recuperar);
router.post('/reset-password',  resetPassword);

module.exports = router;
