const prisma = require('../config/prisma');

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Planes públicos. `precio` = mensual base (+ ITBMS aparte). `precioAnual` = total al año (2 meses gratis).
const PLANES = {
  EMPRENDE:    { nombre: 'EMPRENDE',    label: 'Emprende',    precio: 14.99, precioAnual: 149.90 },
  BASICO:      { nombre: 'BASICO',      label: 'Básico',      precio: 24.99, precioAnual: 249.90 },
  PROFESIONAL: { nombre: 'PROFESIONAL', label: 'Profesional', precio: 39.99, precioAnual: 399.90 },
  DESPACHO:    { nombre: 'DESPACHO',    label: 'Despacho',    precio: 74.99, precioAnual: 749.90 },
  ENTERPRISE:  { nombre: 'ENTERPRISE',  label: 'Enterprise',  precio: 89.99, precioAnual: 899.90 },
};

// Plan IDs de PayPal por tier y periodicidad (se leen de env en runtime).
const PLAN_IDS = {
  EMPRENDE:    { mensual: () => process.env.PAYPAL_PLAN_ID_EMPRENDE,    anual: () => process.env.PAYPAL_PLAN_ID_EMPRENDE_ANUAL },
  BASICO:      { mensual: () => process.env.PAYPAL_PLAN_ID_BASICO,      anual: () => process.env.PAYPAL_PLAN_ID_BASICO_ANUAL },
  PROFESIONAL: { mensual: () => process.env.PAYPAL_PLAN_ID_PROFESIONAL, anual: () => process.env.PAYPAL_PLAN_ID_PROFESIONAL_ANUAL },
  DESPACHO:    { mensual: () => process.env.PAYPAL_PLAN_ID_DESPACHO,    anual: () => process.env.PAYPAL_PLAN_ID_DESPACHO_ANUAL },
  ENTERPRISE:  { mensual: () => process.env.PAYPAL_PLAN_ID_ENTERPRISE,  anual: () => process.env.PAYPAL_PLAN_ID_ENTERPRISE_ANUAL },
};

// Planes Fundador: precio especial de por vida, NO listados públicamente.
// Cada uno da acceso al mismo tier indicado en `tier`.
const FUNDADORES = {
  FUNDADOR_DESPACHO:   { tier: 'DESPACHO',   precio: 59.99, id: () => process.env.PAYPAL_PLAN_ID_FUNDADOR_DESPACHO },
  FUNDADOR_ENTERPRISE: { tier: 'ENTERPRISE', precio: 74.99, id: () => process.env.PAYPAL_PLAN_ID_FUNDADOR_ENTERPRISE },
};

// ── Auth helper ───────────────────────────────────────────────────────────────

let _token = null;
let _tokenExpiry = 0;

async function paypalToken() {
  if (_token && Date.now() < _tokenExpiry - 60_000) return _token;
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`PayPal auth error: ${JSON.stringify(d)}`);
  _token = d.access_token;
  _tokenExpiry = Date.now() + d.expires_in * 1000;
  return _token;
}

async function pp(method, path, body) {
  const token = await paypalToken();
  const r = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  return text ? JSON.parse(text) : {};
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function getPlanes(req, res) {
  const planes = Object.values(PLANES).map((p) => ({
    ...p,
    paypalPlanId:      PLAN_IDS[p.nombre].mensual(),
    paypalPlanIdAnual: PLAN_IDS[p.nombre].anual(),
  }));
  res.json({ ok: true, data: planes });
}

async function activarSuscripcion(req, res) {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId requerido' });

  const sub = await pp('GET', `/v1/billing/subscriptions/${subscriptionId}`);
  if (!['ACTIVE', 'APPROVED'].includes(sub.status)) {
    return res.status(400).json({ error: `Suscripción PayPal en estado: ${sub.status}` });
  }

  const planNombre = _planPorPaypalId(sub.plan_id);
  const venceEn = new Date();
  venceEn.setMonth(venceEn.getMonth() + 1);

  const empresa = await prisma.empresa.update({
    where: { id: req.usuario.empresaId },
    data: {
      plan: planNombre || 'BASICO',
      paypalSubscriptionId: subscriptionId,
      trialVence: null,
    },
  });

  res.json({ ok: true, data: empresa });
}

async function cancelarSuscripcion(req, res) {
  const empresa = await prisma.empresa.findUnique({ where: { id: req.usuario.empresaId } });
  if (!empresa?.paypalSubscriptionId) {
    return res.status(400).json({ error: 'No hay suscripción PayPal activa' });
  }

  await pp('POST', `/v1/billing/subscriptions/${empresa.paypalSubscriptionId}/cancel`, {
    reason: 'Cancelada por el usuario.',
  });

  await prisma.empresa.update({
    where: { id: req.usuario.empresaId },
    data: { plan: 'TRIAL', paypalSubscriptionId: null },
  });

  res.json({ ok: true, message: 'Suscripción cancelada.' });
}

async function webhook(req, res) {
  const verificacion = await pp('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo:         req.headers['paypal-auth-algo'],
    cert_url:          req.headers['paypal-cert-url'],
    client_id:         process.env.PAYPAL_CLIENT_ID,
    transmission_id:   req.headers['paypal-transmission-id'],
    transmission_sig:  req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:     JSON.parse(req.rawBody),
  });

  if (verificacion.verification_status !== 'SUCCESS') {
    return res.status(400).json({ error: 'Webhook no verificado' });
  }

  const evento = JSON.parse(req.rawBody);
  const subscriptionId = evento.resource?.id ?? evento.resource?.billing_agreement_id;
  if (!subscriptionId) return res.json({ ignorado: true });

  const empresa = await prisma.empresa.findFirst({ where: { paypalSubscriptionId: subscriptionId } });
  if (!empresa) return res.json({ ignorado: true, razon: 'empresa no encontrada' });

  await _aplicarEvento(empresa, evento.event_type, evento.resource, subscriptionId);
  res.json({ ok: true, evento: evento.event_type });
}

// ── Privados ──────────────────────────────────────────────────────────────────

function _planPorPaypalId(planId) {
  if (!planId) return null;
  // Mensual o anual de cualquier tier
  for (const [tier, ids] of Object.entries(PLAN_IDS)) {
    if (planId === ids.mensual() || planId === ids.anual()) return tier;
  }
  // Planes Fundador → dan acceso a su tier base
  for (const f of Object.values(FUNDADORES)) {
    if (planId === f.id()) return f.tier;
  }
  return null;
}

async function _aplicarEvento(empresa, eventType, resource, subscriptionId) {
  let data = {};

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
      data = { activa: true };
      if (resource?.plan_id) data.plan = _planPorPaypalId(resource.plan_id) || empresa.plan;
      break;
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      data = { plan: 'TRIAL', paypalSubscriptionId: null };
      break;
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      data = { activa: false };
      break;
    default:
      return;
  }

  await prisma.empresa.update({ where: { id: empresa.id }, data });
}

module.exports = { getPlanes, activarSuscripcion, cancelarSuscripcion, webhook };
