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
      paypalSubscriptionId: true,
      _count: { select: { usuarios: true } },
      usuarios: {
        select: {
          id: true, nombre: true, email: true, activo: true, ultimoAcceso: true,
          rol: { select: { nombre: true } },
        },
        orderBy: { creadoEn: 'asc' },
      },
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

// PATCH /api/admin/empresas/:id/plan
// Activa/cambia el plan de una empresa manualmente (útil para clientes Fundador
// o cortesías). Si el plan no es TRIAL, quita el vencimiento de prueba y la activa.
const PLANES_VALIDOS = ['TRIAL', 'EMPRENDE', 'BASICO', 'PROFESIONAL', 'DESPACHO', 'ENTERPRISE'];

async function cambiarPlan(req, res) {
  if (!verificarAdminKey(req, res)) return;

  const id   = parseInt(req.params.id);
  const plan = req.body.plan?.toUpperCase();

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!PLANES_VALIDOS.includes(plan)) {
    return res.status(400).json({ error: `Plan inválido. Usa: ${PLANES_VALIDOS.join(', ')}` });
  }

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        plan,
        activa: true,
        // Un plan pagado no tiene vencimiento de prueba.
        ...(plan !== 'TRIAL' && { trialVence: null }),
      },
      select: { id: true, nombre: true, plan: true, trialVence: true, activa: true },
    });

    return res.json({ mensaje: `Plan cambiado a ${plan}`, empresa: actualizada });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar el plan' });
  }
}

module.exports = { listarEmpresas, extenderTrial, cambiarPlan };
