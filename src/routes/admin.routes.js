const express = require('express');
const { listarEmpresas, extenderTrial } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/empresas',              listarEmpresas);
router.patch('/empresas/:id/trial',  extenderTrial);

module.exports = router;
