const prisma  = require('../config/prisma');
const multer  = require('multer');

const MAX_SIZE   = 5 * 1024 * 1024; // 5 MB
const MIME_OK    = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (MIME_OK.has(file.mimetype)) return cb(null, true);
    cb(new Error('TIPO_NO_PERMITIDO'));
  },
});

// ─── Middleware reutilizable ──────────────────────────────────────────────────

const uploadMiddleware = upload.single('archivo');

function manejarUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.message === 'TIPO_NO_PERMITIDO') {
      return res.status(415).json({ error: 'Tipo de archivo no permitido. Use PDF, imágenes o documentos Office.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo supera el límite de 5 MB.' });
    }
    return res.status(400).json({ error: 'Error al procesar el archivo.' });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validarTipo(tipo) {
  return tipo === 'FACTURA' || tipo === 'ORDEN_COMPRA';
}

async function verificarPertenencia(empresaId, tipo, referenciaId) {
  if (tipo === 'FACTURA') {
    const f = await prisma.factura.findFirst({ where: { id: referenciaId, empresaId }, select: { id: true } });
    return !!f;
  }
  const o = await prisma.ordenCompra.findFirst({ where: { id: referenciaId, empresaId }, select: { id: true } });
  return !!o;
}

// ─── Listar adjuntos ─────────────────────────────────────────────────────────

async function listar(req, res) {
  const { empresaId } = req.usuario;
  const tipo        = req.params.tipo?.toUpperCase();
  const referenciaId = parseInt(req.params.referenciaId);

  if (!validarTipo(tipo) || isNaN(referenciaId)) {
    return res.status(400).json({ error: 'Parámetros inválidos.' });
  }

  const pertenece = await verificarPertenencia(empresaId, tipo, referenciaId);
  if (!pertenece) return res.status(404).json({ error: 'Documento no encontrado.' });

  const adjuntos = await prisma.adjunto.findMany({
    where: { empresaId, tipo, referenciaId },
    select: { id: true, nombre: true, mimeType: true, tamano: true, creadoEn: true },
    orderBy: { creadoEn: 'asc' },
  });

  return res.json(adjuntos);
}

// ─── Subir adjunto ───────────────────────────────────────────────────────────

async function subir(req, res) {
  const { empresaId } = req.usuario;
  const tipo        = req.params.tipo?.toUpperCase();
  const referenciaId = parseInt(req.params.referenciaId);

  if (!validarTipo(tipo) || isNaN(referenciaId)) {
    return res.status(400).json({ error: 'Parámetros inválidos.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere un archivo.' });
  }

  const pertenece = await verificarPertenencia(empresaId, tipo, referenciaId);
  if (!pertenece) return res.status(404).json({ error: 'Documento no encontrado.' });

  const adjunto = await prisma.adjunto.create({
    data: {
      empresaId,
      tipo,
      referenciaId,
      nombre:   req.file.originalname,
      mimeType: req.file.mimetype,
      tamano:   req.file.size,
      datos:    req.file.buffer,
    },
    select: { id: true, nombre: true, mimeType: true, tamano: true, creadoEn: true },
  });

  return res.status(201).json(adjunto);
}

// ─── Descargar adjunto ───────────────────────────────────────────────────────

async function descargar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  const adjunto = await prisma.adjunto.findFirst({
    where: { id, empresaId },
  });
  if (!adjunto) return res.status(404).json({ error: 'Adjunto no encontrado.' });

  res.setHeader('Content-Type', adjunto.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(adjunto.nombre)}"`);
  res.setHeader('Content-Length', adjunto.tamano);
  return res.end(adjunto.datos);
}

// ─── Eliminar adjunto ────────────────────────────────────────────────────────

async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  const adjunto = await prisma.adjunto.findFirst({ where: { id, empresaId }, select: { id: true } });
  if (!adjunto) return res.status(404).json({ error: 'Adjunto no encontrado.' });

  await prisma.adjunto.delete({ where: { id } });
  return res.json({ mensaje: 'Adjunto eliminado.' });
}

module.exports = { manejarUpload, listar, subir, descargar, eliminar };
