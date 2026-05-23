const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const prisma   = require('../config/prisma');
const { PLANTILLAS_ROLES } = require('../config/roles');
const { enviarBienvenida, enviarRecuperacionPassword } = require('../services/email.service');

const SALT_ROUNDS = 10;

function generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
}

// POST /api/auth/registro
// Crea una empresa nueva con su primer usuario administrador
async function registro(req, res) {
  const { empresa, usuario } = req.body;

  if (!empresa?.ruc || !empresa?.nombre) {
    return res.status(400).json({ error: 'RUC y nombre de empresa son requeridos' });
  }
  if (!usuario?.nombre || !usuario?.email || !usuario?.password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña del usuario son requeridos' });
  }
  if (usuario.password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Verificar que el RUC no exista
      const empresaExistente = await tx.empresa.findUnique({ where: { ruc: empresa.ruc } });
      if (empresaExistente) {
        throw new Error('RUC_DUPLICADO');
      }

      // Verificar que el email no exista
      const usuarioExistente = await tx.usuario.findUnique({ where: { email: usuario.email } });
      if (usuarioExistente) {
        throw new Error('EMAIL_DUPLICADO');
      }

      // Crear todos los roles base si no existen
      for (const plantilla of PLANTILLAS_ROLES) {
        await tx.rol.upsert({
          where:  { nombre: plantilla.nombre },
          update: {},
          create: { nombre: plantilla.nombre, descripcion: plantilla.descripcion, permisos: plantilla.permisos },
        });
      }
      const rolAdmin = await tx.rol.findUnique({ where: { nombre: 'ADMIN' } });

      // Crear empresa con trial de 14 días
      const trialVence = new Date();
      trialVence.setDate(trialVence.getDate() + 14);

      const nuevaEmpresa = await tx.empresa.create({
        data: {
          ruc: empresa.ruc,
          nombre: empresa.nombre,
          nombreComercial: empresa.nombreComercial || null,
          direccion: empresa.direccion || null,
          telefono: empresa.telefono || null,
          email: empresa.email || null,
          plan: 'TRIAL',
          trialVence,
        },
      });

      // Crear usuario administrador
      const passwordHash = await bcrypt.hash(usuario.password, SALT_ROUNDS);
      const nuevoUsuario = await tx.usuario.create({
        data: {
          empresaId: nuevaEmpresa.id,
          rolId: rolAdmin.id,
          nombre: usuario.nombre,
          email: usuario.email,
          password: passwordHash,
        },
      });

      // Vincular usuario a su empresa en la tabla multi-empresa
      await tx.usuarioEmpresa.create({
        data: { usuarioId: nuevoUsuario.id, empresaId: nuevaEmpresa.id, rolId: rolAdmin.id },
      });

      return { empresa: nuevaEmpresa, usuario: nuevoUsuario, rol: rolAdmin };
    });

    const token = generarToken({
      usuarioId: resultado.usuario.id,
      empresaId: resultado.empresa.id,
      rolId: resultado.rol.id,
      rol: resultado.rol.nombre,
    });

    // Email de bienvenida — falla silencioso si no hay SMTP
    enviarBienvenida({
      nombre:        resultado.usuario.nombre,
      nombreEmpresa: resultado.empresa.nombre,
      email:         resultado.usuario.email,
    }).catch(() => {});

    return res.status(201).json({
      mensaje: 'Empresa y usuario creados exitosamente',
      token,
      empresa: {
        id: resultado.empresa.id,
        ruc: resultado.empresa.ruc,
        nombre: resultado.empresa.nombre,
      },
      usuario: {
        id: resultado.usuario.id,
        nombre: resultado.usuario.nombre,
        email: resultado.usuario.email,
        rol: resultado.rol.nombre,
      },
    });
  } catch (err) {
    if (err.message === 'RUC_DUPLICADO') {
      return res.status(409).json({ error: 'Ya existe una empresa registrada con ese RUC' });
    }
    if (err.message === 'EMAIL_DUPLICADO') {
      return res.status(409).json({ error: 'Ya existe un usuario registrado con ese email' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar la empresa' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { rol: true, empresa: true },
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!usuario.empresa.activa) {
      return res.status(403).json({ error: 'La empresa está inactiva' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    // Garantizar fila en usuario_empresas (safety net para usuarios previos a multi-empresa)
    await prisma.usuarioEmpresa.upsert({
      where: { usuarioId_empresaId: { usuarioId: usuario.id, empresaId: usuario.empresaId } },
      update: {},
      create: { usuarioId: usuario.id, empresaId: usuario.empresaId, rolId: usuario.rolId },
    });

    const token = generarToken({
      usuarioId: usuario.id,
      empresaId: usuario.empresaId,
      rolId: usuario.rolId,
      rol: usuario.rol.nombre,
    });

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol.nombre,
      },
      empresa: {
        id: usuario.empresa.id,
        ruc: usuario.empresa.ruc,
        nombre: usuario.empresa.nombre,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// GET /api/auth/me  (ruta protegida — requiere token)
async function perfil(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.usuarioId },
      include: { rol: true, empresa: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const ahora = new Date();
    const trialVence = usuario.empresa.trialVence ? new Date(usuario.empresa.trialVence) : null;
    const diasRestantes = trialVence
      ? Math.max(0, Math.ceil((trialVence - ahora) / (1000 * 60 * 60 * 24)))
      : null;

    return res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol.nombre,
      ultimoAcceso: usuario.ultimoAcceso,
      empresa: {
        id: usuario.empresa.id,
        ruc: usuario.empresa.ruc,
        nombre: usuario.empresa.nombre,
        plan: usuario.empresa.plan,
        trialVence: usuario.empresa.trialVence,
        diasRestantes,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
}

// POST /api/auth/recuperar  — genera token y envía email
async function recuperar(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Respuesta genérica para no revelar si el email existe
    if (!usuario || !usuario.activo) {
      return res.json({ mensaje: 'Si ese correo está registrado, recibirás un enlace en minutos.' });
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expira  = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { resetToken: token, resetTokenExp: expira },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const enlace = `${frontendUrl}/reset-password?token=${token}`;

    await enviarRecuperacionPassword({ nombre: usuario.nombre, email: usuario.email, enlace });

    return res.json({ mensaje: 'Si ese correo está registrado, recibirás un enlace en minutos.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

// POST /api/auth/reset-password  — valida token y actualiza contraseña
async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token y contraseña son requeridos' });
  if (password.length < 8)  return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        resetToken:    token,
        resetTokenExp: { gt: new Date() },
        activo:        true,
      },
    });

    if (!usuario) {
      return res.status(400).json({ error: 'El enlace es inválido o ha expirado. Solicita uno nuevo.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { password: passwordHash, resetToken: null, resetTokenExp: null },
    });

    return res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
}

// POST /api/auth/cambiar-empresa/:empresaId  (ruta protegida)
async function cambiarEmpresa(req, res) {
  const { usuarioId } = req.usuario;
  const empresaId = parseInt(req.params.empresaId);

  if (isNaN(empresaId)) return res.status(400).json({ error: 'ID de empresa inválido' });

  try {
    const vinculo = await prisma.usuarioEmpresa.findUnique({
      where: { usuarioId_empresaId: { usuarioId, empresaId } },
      include: { rol: true, empresa: true },
    });

    if (!vinculo || !vinculo.empresa.activa) {
      return res.status(403).json({ error: 'No tienes acceso a esta empresa' });
    }

    const token = generarToken({
      usuarioId,
      empresaId,
      rolId: vinculo.rolId,
      rol:   vinculo.rol.nombre,
    });

    return res.json({
      token,
      empresa: {
        id:     vinculo.empresa.id,
        ruc:    vinculo.empresa.ruc,
        nombre: vinculo.empresa.nombre,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar de empresa' });
  }
}

module.exports = { registro, login, perfil, recuperar, resetPassword, cambiarEmpresa };
