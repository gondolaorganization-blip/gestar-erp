const prisma = require('../config/prisma');

const TIPOS_VALIDOS = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'];

// Plan de cuentas estándar para Panamá
const PLAN_SEMILLA = [
  // ── ACTIVOS ──────────────────────────────────────────────
  { codigo: '1',      nombre: 'ACTIVOS',                        tipo: 'ACTIVO',    nivel: 1, acepta: false },
  { codigo: '1.1',    nombre: 'Activo Corriente',               tipo: 'ACTIVO',    nivel: 2, padre: '1',   acepta: false },
  { codigo: '1.1.01', nombre: 'Caja General',                   tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.1.02', nombre: 'Banco — Cuenta Corriente',       tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.1.03', nombre: 'Cuentas por Cobrar Clientes',    tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.1.04', nombre: 'ITBMS por Cobrar',               tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.1.05', nombre: 'Inventario de Mercancías',       tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.1.06', nombre: 'Gastos Pagados por Anticipado',  tipo: 'ACTIVO',    nivel: 3, padre: '1.1', acepta: true  },
  { codigo: '1.2',    nombre: 'Activo No Corriente',            tipo: 'ACTIVO',    nivel: 2, padre: '1',   acepta: false },
  { codigo: '1.2.01', nombre: 'Propiedades y Equipos',          tipo: 'ACTIVO',    nivel: 3, padre: '1.2', acepta: true  },
  { codigo: '1.2.02', nombre: 'Depreciación Acumulada',         tipo: 'ACTIVO',    nivel: 3, padre: '1.2', acepta: true  },
  // ── PASIVOS ──────────────────────────────────────────────
  { codigo: '2',      nombre: 'PASIVOS',                        tipo: 'PASIVO',    nivel: 1, acepta: false },
  { codigo: '2.1',    nombre: 'Pasivo Corriente',               tipo: 'PASIVO',    nivel: 2, padre: '2',   acepta: false },
  { codigo: '2.1.01', nombre: 'Cuentas por Pagar Proveedores',  tipo: 'PASIVO',    nivel: 3, padre: '2.1', acepta: true  },
  { codigo: '2.1.02', nombre: 'ITBMS por Pagar (DGI)',          tipo: 'PASIVO',    nivel: 3, padre: '2.1', acepta: true  },
  { codigo: '2.1.03', nombre: 'Impuesto sobre la Renta por Pagar', tipo: 'PASIVO', nivel: 3, padre: '2.1', acepta: true  },
  { codigo: '2.1.04', nombre: 'Sueldos y Salarios por Pagar',   tipo: 'PASIVO',    nivel: 3, padre: '2.1', acepta: true  },
  { codigo: '2.1.05', nombre: 'CSS por Pagar',                  tipo: 'PASIVO',    nivel: 3, padre: '2.1', acepta: true  },
  { codigo: '2.2',    nombre: 'Pasivo No Corriente',            tipo: 'PASIVO',    nivel: 2, padre: '2',   acepta: false },
  { codigo: '2.2.01', nombre: 'Préstamos Bancarios L/P',        tipo: 'PASIVO',    nivel: 3, padre: '2.2', acepta: true  },
  // ── PATRIMONIO ───────────────────────────────────────────
  { codigo: '3',      nombre: 'PATRIMONIO',                     tipo: 'PATRIMONIO', nivel: 1, acepta: false },
  { codigo: '3.1',    nombre: 'Capital',                        tipo: 'PATRIMONIO', nivel: 2, padre: '3',   acepta: false },
  { codigo: '3.1.01', nombre: 'Capital Social',                 tipo: 'PATRIMONIO', nivel: 3, padre: '3.1', acepta: true  },
  { codigo: '3.1.02', nombre: 'Utilidades Retenidas',           tipo: 'PATRIMONIO', nivel: 3, padre: '3.1', acepta: true  },
  { codigo: '3.1.03', nombre: 'Utilidad del Ejercicio',         tipo: 'PATRIMONIO', nivel: 3, padre: '3.1', acepta: true  },
  // ── INGRESOS ─────────────────────────────────────────────
  { codigo: '4',      nombre: 'INGRESOS',                       tipo: 'INGRESO',   nivel: 1, acepta: false },
  { codigo: '4.1',    nombre: 'Ingresos Operacionales',         tipo: 'INGRESO',   nivel: 2, padre: '4',   acepta: false },
  { codigo: '4.1.01', nombre: 'Ventas de Bienes',               tipo: 'INGRESO',   nivel: 3, padre: '4.1', acepta: true  },
  { codigo: '4.1.02', nombre: 'Ingresos por Servicios',         tipo: 'INGRESO',   nivel: 3, padre: '4.1', acepta: true  },
  { codigo: '4.2',    nombre: 'Otros Ingresos',                 tipo: 'INGRESO',   nivel: 2, padre: '4',   acepta: false },
  { codigo: '4.2.01', nombre: 'Ingresos Financieros',           tipo: 'INGRESO',   nivel: 3, padre: '4.2', acepta: true  },
  { codigo: '4.2.02', nombre: 'Otros Ingresos No Operacionales',tipo: 'INGRESO',   nivel: 3, padre: '4.2', acepta: true  },
  // ── GASTOS ───────────────────────────────────────────────
  { codigo: '5',      nombre: 'GASTOS',                         tipo: 'GASTO',     nivel: 1, acepta: false },
  { codigo: '5.1',    nombre: 'Costo de Ventas',                tipo: 'GASTO',     nivel: 2, padre: '5',   acepta: false },
  { codigo: '5.1.01', nombre: 'Costo de Mercancías Vendidas',   tipo: 'GASTO',     nivel: 3, padre: '5.1', acepta: true  },
  { codigo: '5.2',    nombre: 'Gastos Operacionales',           tipo: 'GASTO',     nivel: 2, padre: '5',   acepta: false },
  { codigo: '5.2.01', nombre: 'Sueldos y Salarios',             tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.02', nombre: 'Cuota Patronal CSS',             tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.03', nombre: 'Alquiler de Local',              tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.04', nombre: 'Servicios Públicos',             tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.05', nombre: 'Gastos de Oficina y Papelería',  tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.06', nombre: 'Depreciación de Activos',        tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.07', nombre: 'Gastos Bancarios y Comisiones',  tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.08', nombre: 'Publicidad y Mercadeo',          tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.09', nombre: 'Gastos de Representación',       tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
  { codigo: '5.2.10', nombre: 'Gastos Varios',                  tipo: 'GASTO',     nivel: 3, padre: '5.2', acepta: true  },
];

// GET /api/cuentas
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const arbol = req.query.arbol === 'true';
  const tipo = req.query.tipo?.toUpperCase() || '';
  const soloAcepta = req.query.soloAcepta === 'true';

  const donde = {
    empresaId,
    ...(tipo && TIPOS_VALIDOS.includes(tipo) && { tipo }),
    ...(soloAcepta && { acepta: true }),
  };

  try {
    const cuentas = await prisma.cuentaContable.findMany({
      where: donde,
      orderBy: { codigo: 'asc' },
    });

    if (!arbol) return res.json(cuentas);

    // Construir árbol jerárquico
    const mapa = {};
    cuentas.forEach((c) => { mapa[c.codigo] = { ...c, hijos: [] }; });
    const raices = [];
    cuentas.forEach((c) => {
      if (c.padre && mapa[c.padre]) {
        mapa[c.padre].hijos.push(mapa[c.codigo]);
      } else {
        raices.push(mapa[c.codigo]);
      }
    });

    return res.json(raices);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el plan de cuentas' });
  }
}

// GET /api/cuentas/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const cuenta = await prisma.cuentaContable.findFirst({ where: { id, empresaId } });
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    return res.json(cuenta);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener la cuenta' });
  }
}

// POST /api/cuentas
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { codigo, nombre, tipo, nivel, padre, acepta } = req.body;

  if (!codigo || !nombre || !tipo) {
    return res.status(400).json({ error: 'Código, nombre y tipo son requeridos' });
  }
  if (!TIPOS_VALIDOS.includes(tipo.toUpperCase())) {
    return res.status(400).json({ error: `Tipo debe ser: ${TIPOS_VALIDOS.join(', ')}` });
  }

  try {
    // Verificar que la cuenta padre existe si se especifica
    if (padre) {
      const cuentaPadre = await prisma.cuentaContable.findFirst({
        where: { empresaId, codigo: padre },
      });
      if (!cuentaPadre) {
        return res.status(404).json({ error: `Cuenta padre con código "${padre}" no encontrada` });
      }
    }

    const cuenta = await prisma.cuentaContable.create({
      data: {
        empresaId,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        tipo: tipo.toUpperCase(),
        nivel: nivel ? parseInt(nivel) : 1,
        padre: padre?.trim() || null,
        acepta: acepta !== false && acepta !== 'false',
      },
    });

    return res.status(201).json(cuenta);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese código' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la cuenta' });
  }
}

// PUT /api/cuentas/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  const { nombre, acepta } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const existe = await prisma.cuentaContable.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const cuenta = await prisma.cuentaContable.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        ...(acepta !== undefined && { acepta: acepta !== false && acepta !== 'false' }),
      },
    });

    return res.json(cuenta);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar la cuenta' });
  }
}

// POST /api/cuentas/semilla  — carga el plan de cuentas estándar panameño
async function semilla(req, res) {
  const { empresaId } = req.usuario;

  try {
    const existentes = await prisma.cuentaContable.count({ where: { empresaId } });
    if (existentes > 0) {
      return res.status(409).json({
        error: 'Ya existe un plan de cuentas para esta empresa',
        total: existentes,
      });
    }

    await prisma.cuentaContable.createMany({
      data: PLAN_SEMILLA.map((c) => ({ ...c, empresaId })),
    });

    return res.status(201).json({
      mensaje: 'Plan de cuentas estándar panameño cargado exitosamente',
      total: PLAN_SEMILLA.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cargar el plan de cuentas' });
  }
}

module.exports = { listar, obtener, crear, actualizar, semilla };
