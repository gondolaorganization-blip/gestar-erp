/**
 * setup-planes-erp.mjs — Gestar ERP
 *
 * Crea en PayPal Live la nueva estructura de planes de Gestar ERP:
 *   - 5 planes MENSUALES:  Emprende, Básico, Profesional, Despacho, Enterprise
 *   - 5 planes ANUALES:    (mismos tiers, 2 meses gratis)
 *   - 2 planes FUNDADOR:   Despacho y Enterprise, precio de por vida (mensual)
 *
 * Al final imprime las variables PAYPAL_PLAN_ID_* listas para pegar en Render.
 *
 * Uso:
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/setup-planes-erp.mjs
 *
 * (Las credenciales son las mismas que ya tienes en Render para gestar-erp-backend.)
 */

const BASE          = 'https://api-m.paypal.com';
const CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// ── Configuración de ITBMS ─────────────────────────────────────────────────────
// COBRAR_ITBMS = true  → el cliente paga el precio base + 7% (no te comes el ITBMS).
// COBRAR_ITBMS = false → el precio base ya incluye el ITBMS (sale de tu margen).
const ITBMS         = 0.07;
const COBRAR_ITBMS  = false;   // por ahora ITBMS incluido en el precio. Cambiar a true para cobrar base + 7%.

// Precio que realmente se cobra en PayPal, con 2 decimales.
const cobrar = (base) => (COBRAR_ITBMS ? base * (1 + ITBMS) : base).toFixed(2);

// ── Definición de precios (base, sin ITBMS) ────────────────────────────────────
const TIERS = [
  { key: 'EMPRENDE',    label: 'Emprende',    mensual: 14.99 },
  { key: 'BASICO',      label: 'Básico',      mensual: 24.99 },
  { key: 'PROFESIONAL', label: 'Profesional', mensual: 39.99 },
  { key: 'DESPACHO',    label: 'Despacho',    mensual: 74.99 },
  { key: 'ENTERPRISE',  label: 'Enterprise',  mensual: 89.99 },
];
// Anual = 10 meses (2 gratis).
const anualBase = (mensual) => Math.round(mensual * 10 * 100) / 100;

const FUNDADORES = [
  { key: 'FUNDADOR_DESPACHO',   label: 'Despacho Fundador',   mensual: 59.99 },
  { key: 'FUNDADOR_ENTERPRISE', label: 'Enterprise Fundador', mensual: 74.99 },
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  Faltan credenciales:\n  PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/setup-planes-erp.mjs\n');
  process.exit(1);
}

// ── Helpers PayPal ──────────────────────────────────────────────────────────────
async function getToken() {
  const cred = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token fallido: ' + JSON.stringify(data));
  return data.access_token;
}

let _rid = 0;
async function pp(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `erp-planes-${++_rid}-${Date.now()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function planBody(productId, nombre, precioBase, intervalUnit) {
  return {
    product_id: productId,
    name: nombre,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: intervalUnit, interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: cobrar(precioBase), currency_code: 'USD' } },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: '0', currency_code: 'USD' },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  };
}

async function crearPlan(token, productId, nombre, precioBase, intervalUnit) {
  const res = await pp(token, 'POST', '/v1/billing/plans', planBody(productId, nombre, precioBase, intervalUnit));
  if (!res.id) throw new Error(`Error creando plan "${nombre}": ${JSON.stringify(res)}`);
  console.log(`  ✅  ${nombre.padEnd(30)} USD ${cobrar(precioBase)}  → ${res.id}`);
  return res.id;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄  Conectando con PayPal Live...  (ITBMS ${COBRAR_ITBMS ? 'AÑADIDO +7%' : 'incluido'})`);
  const token = await getToken();
  console.log('✅  Token obtenido.\n');

  console.log('📦  Creando producto "Gestar ERP"...');
  const prod = await pp(token, 'POST', '/v1/catalogs/products', {
    name: 'Gestar ERP',
    description: 'Sistema ERP de contabilidad y gestión empresarial para Panamá.',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
  if (!prod.id) throw new Error(`Error creando producto: ${JSON.stringify(prod)}`);
  console.log(`✅  Producto: ${prod.id}\n`);

  const env = [];

  console.log('💳  Planes MENSUALES:');
  for (const t of TIERS) {
    const id = await crearPlan(token, prod.id, `Gestar ERP ${t.label}`, t.mensual, 'MONTH');
    env.push(`PAYPAL_PLAN_ID_${t.key}=${id}`);
  }

  console.log('\n💳  Planes ANUALES (2 meses gratis):');
  for (const t of TIERS) {
    const id = await crearPlan(token, prod.id, `Gestar ERP ${t.label} Anual`, anualBase(t.mensual), 'YEAR');
    env.push(`PAYPAL_PLAN_ID_${t.key}_ANUAL=${id}`);
  }

  console.log('\n💳  Planes FUNDADOR (de por vida):');
  for (const f of FUNDADORES) {
    const id = await crearPlan(token, prod.id, `Gestar ERP ${f.label}`, f.mensual, 'MONTH');
    env.push(`PAYPAL_PLAN_ID_${f.key}=${id}`);
  }

  console.log('\n\n' + '═'.repeat(60));
  console.log('🎉  LISTO — pega estas variables en Render (gestar-erp-backend):\n');
  env.forEach((v) => console.log(v));
  console.log('═'.repeat(60));
  console.log('\nEnlaces de suscripción para tus clientes Fundador:');
  for (const f of FUNDADORES) {
    const id = env.find((v) => v.startsWith(`PAYPAL_PLAN_ID_${f.key}=`))?.split('=')[1];
    console.log(`  ${f.label}: https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${id}`);
  }
  console.log('');
}

main().catch((err) => { console.error('\n❌  Error:', err.message); process.exit(1); });
