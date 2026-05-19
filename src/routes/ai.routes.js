const { Router } = require('express');
const { chat } = require('../controllers/ai.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { rateLimit } = require('express-rate-limit');

const router = Router();

// Límite conservador para la IA: 30 mensajes por 10 minutos por IP
const limiteIA = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas al asistente IA. Espera unos minutos.' },
});

router.use(verificarToken);
router.post('/chat', limiteIA, chat);

module.exports = router;
