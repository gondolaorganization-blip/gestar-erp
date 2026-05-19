const prisma = require('../config/prisma');

function verificarAdminKey(req, res) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

// GET /api/admin/empresas
async function listarEmpresas(req, res) {
  if (!verificarAdminKey(req, res)) return;

  const empresas = await prisma.empresa.findMany({
    select: {
      id: true, ruc: true, nombre: true, email: true,
      plan: true, trialVence: true, activa: true, creadoEn: true,
      _count: { select: { usuarios: true } },
    },
    orderBy: { creadoEn: 'desc' },
  });

  const ahora = new Date();
  return res.json(empresas.map((e) => ({
    ...e,
    diasRestantes: e.trialVence
      ? Math.max(0, Math.ceil((new Date(e.trialVence) - ahora) / (1000 * 60 * 60 * 24)))
      : null,
  })));
}

// PATCH /api/admin/empresas/:id/trial
async function extenderTrial(req, res) {
  if (!verificarAdminKey(req, res)) return;

  const id   = parseInt(req.params.id);
  const dias = parseInt(req.body.dias) || 30;
  const plan = req.body.plan?.toUpperCase() || null;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const base = empresa.trialVence && new Date(empresa.trialVence) > new Date()
      ? new Date(empresa.trialVence)
      : new Date();

    const nuevaFecha = new Date(base);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);

    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        trialVence: nuevaFecha,
        ...(plan && { plan }),
      },
      select: { id: true, nombre: true, plan: true, trialVence: true },
    });

    return res.json({ mensaje: `Trial extendido ${dias} días`, empresa: actualizada });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al extender trial' });
  }
}

module.exports = { listarEmpresas, extenderTrial };
