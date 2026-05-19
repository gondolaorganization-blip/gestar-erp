const Anthropic  = require('@anthropic-ai/sdk');
const pdfParse   = require('pdf-parse');
const XLSX       = require('xlsx');
const prisma     = require('../config/prisma');

const client = new Anthropic();

// ── Extracción de contenido según tipo de archivo ─────────────────────────────

async function extraerContenido(file) {
  const ext  = file.originalname.toLowerCase();
  const mime = file.mimetype;

  if (mime === 'application/pdf' || ext.endsWith('.pdf')) {
    const data = await pdfParse(file.buffer);
    return data.text;
  }

  if (ext.endsWith('.csv') || mime === 'text/csv' || mime === 'text/plain') {
    return file.buffer.toString('utf-8');
  }

  // Excel (.xlsx / .xls)
  const wb  = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  // CSV representation preserves structure better than JSON for Claude
  return XLSX.utils.sheet_to_csv(ws);
}

// ── POST /api/importacion-bancaria/analizar ───────────────────────────────────

async function analizar(req, res) {
  const { empresaId } = req.usuario;

  if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un archivo (PDF, Excel o CSV)' });

  const banco = (req.body.banco ?? '').trim();

  try {
    // 1. Extraer texto del archivo
    let contenido;
    try {
      contenido = await extraerContenido(req.file);
    } catch {
      return res.status(400).json({ error: 'No se pudo leer el archivo. Si es un PDF escaneado (imagen), expórtalo como Excel o CSV desde la banca en línea.' });
    }

    if (!contenido || contenido.trim().length < 30) {
      return res.status(400).json({ error: 'El archivo parece estar vacío o no tiene transacciones legibles.' });
    }

    // 2. Plan de cuentas de la empresa
    const cuentas = await prisma.cuentaContable.findMany({
      where: { empresaId, acepta: true },
      select: { id: true, codigo: true, nombre: true, tipo: true },
      orderBy: { codigo: 'asc' },
    });

    if (cuentas.length === 0) {
      return res.status(400).json({
        error: 'No tienes un Plan de Cuentas configurado. Ve a Contabilidad → Plan de Cuentas y ejecuta la semilla primero.',
      });
    }

    const cuentasTexto = cuentas
      .map((c) => `  ID:${c.id} | ${c.codigo} | ${c.nombre} [${c.tipo}]`)
      .join('\n');

    const bancoHint = banco
      ? `El estado de cuenta proviene del banco: ${banco}.`
      : 'Detecta automáticamente de qué banco y período es el estado de cuenta.';

    // 3. Prompt — Claude hace DOS cosas: (a) parsea el formato del banco, (b) sugiere cuentas
    const prompt = `Eres un contador público autorizado (CPA) experto en contabilidad panameña con experiencia en estados de cuenta bancarios de Panamá. ${bancoHint}

A continuación tienes el contenido de un estado de cuenta bancario. Tu tarea es:

1. PARSEAR: Identificar cada transacción (fecha, descripción, monto, si es débito o crédito al banco)
2. CATEGORIZAR: Para cada transacción, asignar las cuentas contables correctas usando el Plan de Cuentas de la empresa

CONTENIDO DEL ESTADO DE CUENTA:
${contenido.slice(0, 9000)}

PLAN DE CUENTAS DE LA EMPRESA (SOLO puedes usar cuentas de esta lista):
${cuentasTexto}

REGLAS CONTABLES (partida doble):
- CRÉDITO bancario (depósito, abono, ingreso al banco) → DEBE: cuenta Banco/Caja; HABER: cuenta de Ingreso o Pasivo
- DÉBITO bancario (débito, cargo, pago, salida del banco) → DEBE: cuenta de Gasto o Activo; HABER: cuenta Banco/Caja
- Pagos de nómina/CSS/SEA → Gastos de personal
- Pago de servicios (luz, agua, internet) → Gastos generales
- Compras de insumos → Costo de ventas o Inventario
- Pago de impuestos DGI → ITBMS o Impuestos por pagar
- Transferencias entre cuentas propias → Bancos a Bancos
- Si la descripción es ambigua, elige la cuenta más probable y marca confianza BAJA
- Ignora líneas que sean saldos, encabezados, totales o texto del banco (no son transacciones)

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, sin bloques markdown:

{
  "banco": "nombre del banco detectado",
  "periodo": "descripción del período (ej: Enero 2026)",
  "moneda": "USD",
  "transacciones": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción tal como aparece en el banco",
      "monto": 100.00,
      "tipo": "CREDITO",
      "cuentaDebeId": 1,
      "cuentaDebeCodigo": "1.1.01",
      "cuentaDebeNombre": "Banco General",
      "cuentaHaberId": 2,
      "cuentaHaberCodigo": "4.1.01",
      "cuentaHaberNombre": "Ingresos por servicios",
      "confianza": "ALTA",
      "razonamiento": "Depósito de cliente identificado por descripción"
    }
  ]
}`;

    // 4. Llamar a Claude
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages:   [{ role: 'user', content: prompt }],
    });

    const textoRespuesta = response.content[0].text.trim();

    // 5. Parsear JSON de la respuesta
    let resultado;
    try {
      const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
      resultado = JSON.parse(jsonMatch ? jsonMatch[0] : textoRespuesta);
    } catch {
      return res.status(500).json({
        error: 'La IA no pudo estructurar las transacciones. Intenta con un archivo más limpio o en formato CSV/Excel.',
      });
    }

    return res.json({
      banco:        resultado.banco        ?? banco ?? 'Banco detectado',
      periodo:      resultado.periodo      ?? '',
      moneda:       resultado.moneda       ?? 'USD',
      transacciones: resultado.transacciones ?? [],
      cuentas,    // para los selectores del frontend
    });

  } catch (err) {
    console.error('[importacion] analizar:', err);
    return res.status(500).json({ error: 'Error al procesar el archivo con IA' });
  }
}

// ── POST /api/importacion-bancaria/crear-asientos ─────────────────────────────

async function crearAsientos(req, res) {
  const { empresaId } = req.usuario;
  const { transacciones } = req.body;

  if (!Array.isArray(transacciones) || transacciones.length === 0) {
    return res.status(400).json({ error: 'No hay transacciones para crear' });
  }

  try {
    const ultimo = await prisma.asiento.findFirst({
      where: { empresaId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    let nextNum = (ultimo?.numero ?? 0) + 1;

    let creados = 0;
    for (const t of transacciones) {
      const monto = parseFloat(t.monto);
      if (isNaN(monto) || monto <= 0) continue;
      if (!t.cuentaDebeId || !t.cuentaHaberId) continue;
      if (!t.fecha) continue;

      await prisma.asiento.create({
        data: {
          empresaId,
          numero:      nextNum++,
          fecha:       new Date(t.fecha),
          descripcion: t.descripcion || 'Importación bancaria',
          referencia:  'IMP-BANCARIA',
          tipo:        'AUTOMATICO',
          estado:      'BORRADOR',
          lineas: {
            create: [
              { cuentaId: parseInt(t.cuentaDebeId),  debe: monto, haber: 0,     descripcion: t.descripcion },
              { cuentaId: parseInt(t.cuentaHaberId), debe: 0,     haber: monto, descripcion: t.descripcion },
            ],
          },
        },
      });
      creados++;
    }

    return res.json({
      mensaje:  `${creados} asiento(s) creado(s) en estado BORRADOR. Revísalos en Contabilidad → Asientos.`,
      cantidad: creados,
    });
  } catch (err) {
    console.error('[importacion] crearAsientos:', err);
    return res.status(500).json({ error: 'Error al crear los asientos contables' });
  }
}

module.exports = { analizar, crearAsientos };
