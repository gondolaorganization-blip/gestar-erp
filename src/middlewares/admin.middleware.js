// Verifica que el usuario autenticado tenga rol ADMIN
function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { soloAdmin };
