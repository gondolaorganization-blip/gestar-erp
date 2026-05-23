const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const prisma  = require('../config/prisma');

function generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
}

// GET /api/empresas
// Lista todas las empresas a las que tiene acceso el usuario autenticado
async function listar(req, res) {
  const { usuarioId, empresaId: activa } = req.usuario;

  const vinculadas = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId },
    include: {
      empresa: {
        select: { id: true, nombre: true, ruc: true, plan: true, activa: true, trialVence: true },
      },
      rol: { select: { nombre: true } },
    },
    orderBy: { creadoEn: 'asc' },
  });

  const resultado = vinculadas.map((v) => ({
    id:         v.empresa.id,
    nombre:     v.empresa.nombre,
    ruc:        v.empresa.ruc,
    plan:       v.empresa.plan,
    activa:     v.empresa.activa,
    trialVence: v.empresa.trialVence,
    rol:        v.rol.nombre,
    esActiva:   v.empresa.id === activa,
  }));

  return res.json(resultado);
}

// POST /api/empresas
// Crea una nueva empresa y la vincula al usuario autenticado como ADMIN
async function crear(req, res) {
  const { usuarioId } = req.usuario;
  const { empresa } = req.body;

  if (!empresa?.ruc || !empresa?.nombre) {
    return res.status(400).json({ error: 'RUC y nombre de empresa son requeridos' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const existe = await tx.empresa.findUnique({ where: { ruc: empresa.ruc } });
      if (existe) throw new Error('RUC_DUPLICADO');

      const rolAdmin = await tx.rol.findUnique({ where: { nombre: 'ADMIN' } });
      if (!rolAdmin) throw new Error('ROL_NO_ENCONTRADO');

      const trialVence = new Date();
      trialVence.setDate(trialVence.getDate() + 14);

      const nuevaEmpresa = await tx.empresa.create({
        data: {
          ruc:            empresa.ruc,
          nombre:         empresa.nombre,
          nombreComercial: empresa.nombreComercial || null,
          direccion:      empresa.direccion || null,
          telefono:       empresa.telefono || null,
          email:          empresa.email || null,
          plan:           'TRIAL',
          trialVence,
        },
      });

      await tx.usuarioEmpresa.create({
        data: { usuarioId, empresaId: nuevaEmpresa.id, rolId: rolAdmin.id },
      });

      return { empresa: nuevaEmpresa, rol: rolAdmin };
    });

    const token = generarToken({
      usuarioId,
      empresaId: resultado.empresa.id,
      rolId:     resultado.rol.id,
      rol:       resultado.rol.nombre,
    });

    return res.status(201).json({
      token,
      empresa: {
        id:     resultado.empresa.id,
        ruc:    resultado.empresa.ruc,
        nombre: resultado.empresa.nombre,
      },
    });
  } catch (err) {
    if (err.message === 'RUC_DUPLICADO') {
      return res.status(409).json({ error: 'Ya existe una empresa registrada con ese RUC' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la empresa' });
  }
}

module.exports = { listar, crear };
