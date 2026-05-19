const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../config/prisma');

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const MAX_HISTORY = 10; // máximo de turnos de conversación a enviar

// Trae los datos financieros actuales del usuario para el system prompt
async function obtenerContextoFinanciero(empresaId) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  try {
    const [facturacion, cartera, tesoreria] = await Promise.all([
      prisma.factura.aggregate({
        where: { empresaId, fecha: { gte: inicioMes }, estado: { not: 'ANULADA' } },
        _sum: { total: true, itbms: true },
        _count: { id: true },
      }),
      prisma.factura.aggregate({
        where: { empresaId, estado: 'VENCIDA' },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.lineaAsiento.groupBy({
        by: ['cuentaId'],
        where: {
          asiento: { empresaId, estado: 'APROBADO' },
          cuenta: { codigo: { in: ['2.1.02'] } },
        },
        _sum: { debe: true, haber: true },
      }),
    ]);

    const ingresosMes = Number(facturacion._sum.total ?? 0).toFixed(2);
    const itbmsMes = Number(facturacion._sum.itbms ?? 0).toFixed(2);
    const facturasMes = facturacion._count.id;
    const vencidasMonto = Number(cartera._sum.total ?? 0).toFixed(2);
    const vencidasCant = cartera._count.id;
    const itbmsPorPagar = tesoreria.reduce((s, t) => {
      return s + Number(t._sum.haber ?? 0) - Number(t._sum.debe ?? 0);
    }, 0).toFixed(2);

    return `Datos financieros en tiempo real (${hoy.toLocaleDateString('es-PA')}):
- Ingresos del mes: B/. ${ingresosMes} (${facturasMes} facturas)
- ITBMS generado este mes: B/. ${itbmsMes}
- ITBMS por pagar (tesorería): B/. ${itbmsPorPagar}
- Facturas vencidas: ${vencidasCant} por un total de B/. ${vencidasMonto}`;
  } catch {
    return 'Datos financieros no disponibles en este momento.';
  }
}

// POST /api/ai/chat
async function chat(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Asistente IA no configurado. Agrega ANTHROPIC_API_KEY al archivo .env' });
  }

  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Campo messages requerido (array)' });
  }

  // Validar que cada mensaje tenga role y content
  const validos = ['user', 'assistant'];
  for (const m of messages) {
    if (!validos.includes(m.role) || typeof m.content !== 'string' || !m.content.trim()) {
      return res.status(400).json({ error: 'Cada mensaje debe tener role (user|assistant) y content (string)' });
    }
  }

  // El último mensaje debe ser del usuario
  if (messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'El último mensaje debe ser del usuario' });
  }

  try {
    const { empresaId, nombre } = req.usuario;
    const contextoFinanciero = await obtenerContextoFinanciero(empresaId);

    const systemPrompt = `Eres un asistente contable y financiero especializado en la legislación panameña.
Estás integrado en el sistema GESTAR ERP del usuario ${nombre ?? 'usuario'}.

${contextoFinanciero}

Directrices:
- Responde siempre en español, de forma concisa y profesional
- Usa términos contables panameños (ITBMS, CSS, DGI, balboa, etc.)
- Si no tienes suficiente información para responder con precisión, dilo claramente
- Máximo 4 oraciones por respuesta, salvo que el usuario pida un análisis detallado`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Limitar el historial para no exceder el contexto
    const historial = messages.slice(-MAX_HISTORY);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: historial.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? 'Sin respuesta.';
    return res.json({ text });
  } catch (err) {
    console.error('[AI] Error:', err.message);

    if (err.status === 401) {
      return res.status(503).json({ error: 'API key de Anthropic inválida. Verifica ANTHROPIC_API_KEY en .env' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Límite de uso de la IA alcanzado. Intenta en un momento.' });
    }
    return res.status(500).json({ error: 'Error al contactar el asistente IA' });
  }
}

module.exports = { chat };
