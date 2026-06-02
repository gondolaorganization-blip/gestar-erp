const express = require('express');
const { listarEmpresas, extenderTrial, cambiarPlan } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/empresas',              listarEmpresas);
router.patch('/empresas/:id/trial',  extenderTrial);
router.patch('/empresas/:id/plan',   cambiarPlan);

module.exports = router;
