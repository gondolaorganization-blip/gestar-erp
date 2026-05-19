const jwt    = require('jsonwebtoken');
const prisma = require('../config/prisma');

async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;

    // Verificar estado de la cuenta y del trial
    const empresa = await prisma.empresa.findUnique({
      where:  { id: payload.empresaId },
      select: { plan: true, trialVence: true, activa: true },
    });

    if (!empresa || !empresa.activa) {
      return res.status(403).json({ error: 'Cuenta inactiva. Contacta al soporte.' });
    }

    if (empresa.plan === 'TRIAL' && empresa.trialVence && new Date() > empresa.trialVence) {
      return res.status(402).json({
        error: 'Tu período de prueba de 14 días ha vencido.',
        codigo: 'TRIAL_VENCIDO',
        trialVence: empresa.trialVence,
      });
    }

    req.usuario.plan       = empresa.plan;
    req.usuario.trialVence = empresa.trialVence;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verificarToken };
