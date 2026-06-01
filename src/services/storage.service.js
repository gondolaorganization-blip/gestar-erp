// Servicio de almacenamiento de archivos con Cloudflare R2 (compatible con S3).
//
// Diseño retrocompatible: si las variables R2_* están configuradas, los adjuntos
// se suben a R2 y en la base de datos solo se guarda la "llave" (storageKey).
// Si NO están configuradas, el controlador sigue guardando el binario en Postgres
// (campo `datos`), igual que antes. Así no se rompe nada sin cuenta de Cloudflare.

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

function r2Configurado() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
}

let _client = null;
function cliente() {
  if (_client) return _client;
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return _client;
}

// Sube un buffer y devuelve la llave generada (única, organizada por empresa).
async function subirArchivo(buffer, mimeType, empresaId) {
  const key = `adjuntos/${empresaId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  await cliente().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return key;
}

// Descarga un archivo por su llave y lo devuelve como Buffer.
async function obtenerArchivo(key) {
  const res = await cliente().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Elimina un archivo por su llave. No lanza si ya no existe.
async function eliminarArchivo(key) {
  try {
    await cliente().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    console.error('[storage] No se pudo eliminar de R2:', key, err.message);
  }
}

module.exports = { r2Configurado, subirArchivo, obtenerArchivo, eliminarArchivo };
