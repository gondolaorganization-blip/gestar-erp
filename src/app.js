const express     = require('express');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const prisma      = require('./config/prisma');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ─── SEGURIDAD HTTP ──────────────────────────────────────────────────────────

app.use(helmet());                          // cabeceras de seguridad (CSP, HSTS, etc.)
app.use(compression());                     // compresión gzip de respuestas

// CORS manual — más explícito que el paquete cors
app.use((req, res, next) => {
  const origen = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origen);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── LOGGING ─────────────────────────────────────────────────────────────────

// En producción usa 'combined' (formato Apache); en desarrollo usa 'dev' (colorido y conciso)
app.use(morgan(isProd ? 'combined' : 'dev'));

// ─── PARSERS ─────────────────────────────────────────────────────────────────

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

// Límite estricto solo en auth para frenar fuerza bruta
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,   // ventana de 15 minutos
  max: 20,                     // máximo 20 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
});

// Límite general para el resto de la API
const limiteGeneral = rateLimit({
  windowMs: 60 * 1000,         // ventana de 1 minuto
  max: 300,                    // 300 peticiones por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
});

app.use('/api/auth', limiteAuth);
app.use('/api',      limiteGeneral);

// ─── RUTAS ───────────────────────────────────────────────────────────────────

const authRoutes         = require('./routes/auth.routes');
const clientesRoutes     = require('./routes/clientes.routes');
const productosRoutes    = require('./routes/productos.routes');
const facturasRoutes     = require('./routes/facturas.routes');
const contabilidadRoutes = require('./routes/contabilidad.routes');
const reportesRoutes     = require('./routes/reportes.routes');
const dashboardRoutes    = require('./routes/dashboard.routes');
const usuariosRoutes     = require('./routes/usuarios.routes');
const proveedoresRoutes  = require('./routes/proveedores.routes');
const comprasRoutes      = require('./routes/compras.routes');
const aiRoutes           = require('./routes/ai.routes');
const inventarioRoutes   = require('./routes/inventario.routes');
const empleadosRoutes       = require('./routes/empleados.routes');
const nominaRoutes          = require('./routes/nomina.routes');
const leadsRoutes           = require('./routes/leads.routes');
const oportunidadesRoutes   = require('./routes/oportunidades.routes');
const actividadesCRMRoutes  = require('./routes/actividadesCRM.routes');
const entidadesRoutes       = require('./routes/entidades.routes');
const contactosRoutes       = require('./routes/contactos.routes');
const impuestosRoutes       = require('./routes/impuestos.routes');
const importacionRoutes     = require('./routes/importacion.routes');
const backupRoutes          = require('./routes/backup.routes');
const adminRoutes           = require('./routes/admin.routes');
const paypalRoutes          = require('./routes/paypal.routes');
const empresasRoutes        = require('./routes/empresas.routes');

app.use('/api/auth',         authRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/clientes',     clientesRoutes);
app.use('/api/productos',    productosRoutes);
app.use('/api/facturas',     facturasRoutes);
app.use('/api/contabilidad', contabilidadRoutes);
app.use('/api/reportes',     reportesRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/usuarios',     usuariosRoutes);
app.use('/api/proveedores',  proveedoresRoutes);
app.use('/api/compras',      comprasRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/inventario',   inventarioRoutes);
app.use('/api/empleados',        empleadosRoutes);
app.use('/api/nomina',           nominaRoutes);
app.use('/api/leads',            leadsRoutes);
app.use('/api/oportunidades',    oportunidadesRoutes);
app.use('/api/actividades-crm',  actividadesCRMRoutes);
app.use('/api/entidades',        entidadesRoutes);
app.use('/api/contactos',        contactosRoutes);
app.use('/api/impuestos',            impuestosRoutes);
app.use('/api/importacion-bancaria', importacionRoutes);
app.use('/api/backup',               backupRoutes);
app.use('/api/paypal',               paypalRoutes);
app.use('/api/empresas',             empresasRoutes);

// ─── RAÍZ E HEALTH CHECK ─────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    sistema: 'GESTAR ERP',
    version: '1.0.0',
    descripcion: 'Sistema SaaS de contabilidad y gestión empresarial para Panamá',
    entorno: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      estado: 'ok',
      db: 'conectada',
      entorno: process.env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      memoria: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ estado: 'error', db: 'desconectada', timestamp: new Date().toISOString() });
  }
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── MANEJO DE ERRORES ───────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // En producción no exponer detalles internos del error
  if (isProd) {
    console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  console.error(err.stack);
  res.status(500).json({ error: err.message, stack: err.stack });
});

module.exports = app;
