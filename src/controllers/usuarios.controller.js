const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;

const seleccionSegura = {
  id: true, nombre: true, email: true, activo: true,
  creadoEn: true, ultimoAcceso: true,
  rol: { select: { id: true, nombre: true, permisos: true } },
};

// GET /api/usuarios
async function listar(req, res) {
  const { empresaId } = req.usuario;
  const buscar = req.query.buscar?.trim() || '';
  const soloActivos = req.query.inactivos !== 'true';

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        empresaId,
        ...(soloActivos && { activo: true }),
        ...(buscar && {
          OR: [
            { nombre: { contains: buscar, mode: 'insensitive' } },
            { email: { contains: buscar, mode: 'insensitive' } },
          ],
        }),
      },
      select: seleccionSegura,
      orderBy: { nombre: 'asc' },
    });

    return res.json(usuarios);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

// GET /api/usuarios/:id
async function obtener(req, res) {
  const { empresaId } = req.usuario;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id, empresaId },
      select: seleccionSegura,
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(usuario);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el usuario' });
  }
}

// POST /api/usuarios  (solo ADMIN)
async function crear(req, res) {
  const { empresaId } = req.usuario;
  const { nombre, email, password, rolId } = req.body;

  if (!nombre || !email || !password || !rolId) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rolId son requeridos' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    // Verificar que el rol existe
    const rol = await prisma.rol.findUnique({ where: { id: parseInt(rolId) } });
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await prisma.usuario.create({
      data: {
        empresaId,
        rolId: parseInt(rolId),
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password: passwordHash,
      },
      select: seleccionSegura,
    });

    return res.status(201).json(usuario);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el usuario' });
  }
}

// PUT /api/usuarios/:id  (admin edita cualquiera; usuario edita su propio nombre)
async function actualizar(req, res) {
  const { empresaId, usuarioId, rol } = req.usuario;
  const id = parseInt(req.params.id);
  const { nombre, rolId } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  // Un usuario no-admin solo puede editar su propio perfil y no puede cambiar su rol
  if (rol !== 'ADMIN' && id !== usuarioId) {
    return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
  }
  if (rol !== 'ADMIN' && rolId) {
    return res.status(403).json({ error: 'No tienes permisos para cambiar roles' });
  }

  try {
    const existe = await prisma.usuario.findFirst({ where: { id, empresaId } });
    if (!existe) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Evitar que el admin se quite su propio rol de administrador
    if (rolId && id === usuarioId) {
      const nuevoRol = await prisma.rol.findUnique({ where: { id: parseInt(rolId) } });
      if (nuevoRol && nuevoRol.nombre !== 'ADMIN') {
        return res.status(409).json({ error: 'No puedes quitarte el rol de administrador' });
      }
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: {
        ...(nombre && { nombre: nombre.trim() }),
        ...(rolId && rol === 'ADMIN' && { rolId: parseInt(rolId) }),
      },
      select: seleccionSegura,
    });

    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
}

// PATCH /api/usuarios/:id/password
async function cambiarPassword(req, res) {
  const { empresaId, usuarioId, rol } = req.usuario;
  const id = parseInt(req.params.id);
  const { passwordActual, passwordNuevo, passwordNuevoAdmin } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const esAdmin = rol === 'ADMIN';
  const esPropioUsuario = id === usuarioId;

  if (!esAdmin && !esPropioUsuario) {
    return res.status(403).json({ error: 'No tienes permisos para cambiar esta contraseña' });
  }

  try {
    const usuario = await prisma.usuario.findFirst({ where: { id, empresaId } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (esPropioUsuario) {
      // El propio usuario debe confirmar su contraseña actual
      if (!passwordActual || !passwordNuevo) {
        return res.status(400).json({ error: 'passwordActual y passwordNuevo son requeridos' });
      }
      if (passwordNuevo.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }
      const valida = await bcrypt.compare(passwordActual, usuario.password);
      if (!valida) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

      await prisma.usuario.update({
        where: { id },
        data: { password: await bcrypt.hash(passwordNuevo, SALT_ROUNDS) },
      });
    } else {
      // Admin resetea contraseña de otro usuario
      if (!passwordNuevoAdmin || passwordNuevoAdmin.length < 8) {
        return res.status(400).json({ error: 'passwordNuevoAdmin debe tener al menos 8 caracteres' });
      }
      await prisma.usuario.update({
        where: { id },
        data: { password: await bcrypt.hash(passwordNuevoAdmin, SALT_ROUNDS) },
      });
    }

    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

// PATCH /api/usuarios/:id/toggle  (activar / desactivar — solo ADMIN)
async function toggleActivo(req, res) {
  const { empresaId, usuarioId } = req.usuario;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (id === usuarioId) {
    return res.status(409).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  try {
    const usuario = await prisma.usuario.findFirst({ where: { id, empresaId } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo },
      select: { id: true, nombre: true, email: true, activo: true },
    });

    return res.json({
      mensaje: `Usuario ${actualizado.activo ? 'activado' : 'desactivado'} correctamente`,
      ...actualizado,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarPassword, toggleActivo };
