const prisma = require('../config/prisma');

const CONTRATOS   = ['INDEFINIDO', 'DEFINIDO', 'TEMPORAL'];
const PERIODOS    = ['QUINCENAL', 'MENSUAL'];

// GET /api/empleados
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 20));
  const buscar = req.query.buscar?.trim() || '';
  const soloActivos = req.query.inactivos !== 'true';

  const donde = {
    empresaId,
    ...(soloActivos && { activo: true }),
    ...(buscar && {
      OR: [
        { nombre:      { contains: buscar, mode: 'insensitive' } },
        { apellido:    { contains: buscar, mode: 'insensitive' } },
        { cedula:      { contains: buscar, mode: 'insensitive' } },
        { cargo:       { contains: buscar, mode: 'insensitive' } },
        { departamento:{ contains: buscar, mode: 'insensitive' } },
      ],
    }),
  };

  try {
    const [total, empleados] = await prisma.$transaction([
      prisma.empleado.count({ where: donde }),
      prisma.empleado.findMany({
        where: donde,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return res.json({
      datos: empleados.map(formatear),
      paginacion: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener empleados' });
  }
}

// GET /api/empleados/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const emp = await prisma.empleado.findFirst({ where: { id, empresaId } });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
    return res.json(formatear(emp));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener empleado' });
  }
}

// POST /api/empleados
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { cedula, nombre, apellido, email, telefono, cargo, departamento,
          fechaIngreso, tipoContrato, salarioMensual, periodoPago } = req.body;

  if (!cedula || !nombre || !apellido || !cargo || !fechaIngreso || salarioMensual === undefined) {
    return res.status(400).json({ error: 'Cédula, nombre, apellido, cargo, fecha de ingreso y salario son requeridos' });
  }
  if (tipoContrato && !CONTRATOS.includes(tipoContrato.toUpperCase())) {
    return res.status(400).json({ error: `Tipo contrato debe ser: ${CONTRATOS.join(', ')}` });
  }
  if (periodoPago && !PERIODOS.includes(periodoPago.toUpperCase())) {
    return res.status(400).json({ error: `Período de pago debe ser: ${PERIODOS.join(', ')}` });
  }
  const salNum = parseFloat(salarioMensual);
  if (isNaN(salNum) || salNum <= 0) {
    return res.status(400).json({ error: 'El salario mensual debe ser mayor a 0' });
  }

  try {
    const emp = await prisma.empleado.create({
      data: {
        empresaId,
        cedula: cedula.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        cargo: cargo.trim(),
        departamento: departamento?.trim() || null,
        fechaIngreso: new Date(fechaIngreso),
        tipoContrato: tipoContrato ? tipoContrato.toUpperCase() : 'INDEFINIDO',
        salarioMensual: salNum,
        periodoPago: periodoPago ? periodoPago.toUpperCase() : 'QUINCENAL',
      },
    });
    return res.status(201).json(formatear(emp));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un empleado con esa cédula en esta empresa' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear empleado' });
  }
}

// PUT /api/empleados/:id
async function actualizar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { cedula, nombre, apellido, email, telefono, cargo, departamento,
          fechaIngreso, tipoContrato, salarioMensual, periodoPago } = req.body;

  if (tipoContrato && !CONTRATOS.includes(tipoContrato.toUpperCase())) {
    return res.status(400).json({ error: `Tipo contrato debe ser: ${CONTRATOS.join(', ')}` });
  }
  if (periodoPago && !PERIODOS.includes(periodoPago.toUpperCase())) {
    return res.status(400).json({ error: `Período de pago debe ser: ${PERIODOS.join(', ')}` });
  }
  if (salarioMensual !== undefined) {
    const n = parseFloat(salarioMensual);
    if (isNaN(n) || n <= 0) return res.status(400).json({ error: 'El salario debe ser mayor a 0' });
  }

  try {
    const existe = await prisma.empleado.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Empleado no encontrado' });

    const emp = await prisma.empleado.update({
      where: { id },
      data: {
        ...(cedula      && { cedula: cedula.trim() }),
        ...(nombre      && { nombre: nombre.trim() }),
        ...(apellido    && { apellido: apellido.trim() }),
        ...(email       !== undefined && { email: email?.trim() || null }),
        ...(telefono    !== undefined && { telefono: telefono?.trim() || null }),
        ...(cargo       && { cargo: cargo.trim() }),
        ...(departamento!== undefined && { departamento: departamento?.trim() || null }),
        ...(fechaIngreso && { fechaIngreso: new Date(fechaIngreso) }),
        ...(tipoContrato && { tipoContrato: tipoContrato.toUpperCase() }),
        ...(salarioMensual !== undefined && { salarioMensual: parseFloat(salarioMensual) }),
        ...(periodoPago  && { periodoPago: periodoPago.toUpperCase() }),
      },
    });
    return res.json(formatear(emp));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un empleado con esa cédula' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar empleado' });
  }
}

// DELETE /api/empleados/:id  (baja lógica)
async function eliminar(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existe = await prisma.empleado.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Empleado no encontrado' });

    await prisma.empleado.update({ where: { id }, data: { activo: false } });
    return res.json({ mensaje: 'Empleado desactivado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al desactivar empleado' });
  }
}

function formatear(e) {
  return {
    ...e,
    salarioMensual: Number(e.salarioMensual),
    nombreCompleto: `${e.nombre} ${e.apellido}`,
  };
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
