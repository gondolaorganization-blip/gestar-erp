const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin } = require('../middlewares/admin.middleware');

const roles    = require('../controllers/roles.controller');
const usuarios = require('../controllers/usuarios.controller');

const router = Router();
router.use(verificarToken);

// ─── Roles (solo ADMIN) ───────────────────────────────────────────────────────
router.get('/roles',               soloAdmin, roles.listar);
router.get('/roles/plantillas',    soloAdmin, roles.plantillas);
router.post('/roles',              soloAdmin, roles.crear);
router.put('/roles/:id',           soloAdmin, roles.actualizar);
router.delete('/roles/:id',        soloAdmin, roles.eliminar);

// ─── Usuarios ─────────────────────────────────────────────────────────────────
router.get('/',                    soloAdmin, usuarios.listar);
router.get('/:id',                 usuarios.obtener);           // propio perfil o admin
router.post('/',                   soloAdmin, usuarios.crear);
router.put('/:id',                 usuarios.actualizar);        // propio nombre o admin
router.patch('/:id/password',      usuarios.cambiarPassword);   // propio o admin reset
router.patch('/:id/toggle',        soloAdmin, usuarios.toggleActivo);

module.exports = router;
