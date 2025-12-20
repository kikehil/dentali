const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

// Listar usuarios
const index = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        doctor: true,
        permisos: {
          include: {
            modulo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const modulos = await prisma.modulo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    res.render('configuracion/usuarios/index', {
      title: 'Control de Usuarios',
      usuarios,
      modulos,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar usuarios',
      error,
    });
  }
};

// Mostrar formulario de crear usuario
const create = async (req, res) => {
  try {
    const doctores = await prisma.doctor.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const modulos = await prisma.modulo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    res.render('configuracion/usuarios/create', {
      title: 'Crear Usuario',
      doctores,
      modulos,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar formulario de crear usuario:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar formulario',
      error,
    });
  }
};

// Guardar nuevo usuario
const store = async (req, res) => {
  try {
    const { email, password, nombre, rol, activo, doctorId, modulos } = req.body;

    // Validaciones
    if (!email || !password || !nombre) {
      return res.redirect('/configuracion/usuarios/create?error=' + encodeURIComponent('Email, contraseña y nombre son requeridos'));
    }

    // Verificar si el email ya existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      return res.redirect('/configuracion/usuarios/create?error=' + encodeURIComponent('El email ya está registrado'));
    }

    // Verificar si el doctor ya tiene usuario asignado
    if (doctorId) {
      const doctorConUsuario = await prisma.usuario.findUnique({
        where: { doctorId: parseInt(doctorId) },
      });

      if (doctorConUsuario) {
        return res.redirect('/configuracion/usuarios/create?error=' + encodeURIComponent('Este doctor ya tiene un usuario asignado'));
      }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        rol: rol || 'recepcionista',
        activo: activo === 'on' || activo === true,
        doctorId: doctorId ? parseInt(doctorId) : null,
      },
    });

    // Asignar permisos a módulos
    if (modulos && Array.isArray(modulos)) {
      await Promise.all(
        modulos.map(moduloId =>
          prisma.permisoUsuario.create({
            data: {
              usuarioId: usuario.id,
              moduloId: parseInt(moduloId),
              acceso: true,
            },
          })
        )
      );
    }

    res.redirect('/configuracion/usuarios?success=' + encodeURIComponent('Usuario creado exitosamente'));
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.redirect('/configuracion/usuarios/create?error=' + encodeURIComponent('Error al crear usuario'));
  }
};

// Mostrar formulario de editar usuario
const edit = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      include: {
        doctor: true,
        permisos: {
          include: {
            modulo: true,
          },
        },
      },
    });

    if (!usuario) {
      return res.redirect('/configuracion/usuarios?error=' + encodeURIComponent('Usuario no encontrado'));
    }

    const doctores = await prisma.doctor.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const modulos = await prisma.modulo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    res.render('configuracion/usuarios/edit', {
      title: 'Editar Usuario',
      usuario,
      doctores,
      modulos,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar formulario de editar usuario:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar formulario',
      error,
    });
  }
};

// Actualizar usuario
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, nombre, rol, activo, doctorId, modulos } = req.body;

    // Validaciones
    if (!email || !nombre) {
      return res.redirect(`/configuracion/usuarios/${id}/edit?error=` + encodeURIComponent('Email y nombre son requeridos'));
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
    });

    if (!usuario) {
      return res.redirect('/configuracion/usuarios?error=' + encodeURIComponent('Usuario no encontrado'));
    }

    // Verificar si el email ya existe en otro usuario
    if (email !== usuario.email) {
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        return res.redirect(`/configuracion/usuarios/${id}/edit?error=` + encodeURIComponent('El email ya está registrado'));
      }
    }

    // Verificar si el doctor ya tiene usuario asignado (si cambió)
    if (doctorId && parseInt(doctorId) !== usuario.doctorId) {
      const doctorConUsuario = await prisma.usuario.findUnique({
        where: { doctorId: parseInt(doctorId) },
      });

      if (doctorConUsuario && doctorConUsuario.id !== parseInt(id)) {
        return res.redirect(`/configuracion/usuarios/${id}/edit?error=` + encodeURIComponent('Este doctor ya tiene un usuario asignado'));
      }
    }

    // Preparar datos de actualización
    const updateData = {
      email,
      nombre,
      rol: rol || 'recepcionista',
      activo: activo === 'on' || activo === true,
      doctorId: doctorId ? parseInt(doctorId) : null,
    };

    // Si se proporcionó una nueva contraseña, hashearla
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Actualizar usuario
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // Eliminar permisos existentes
    await prisma.permisoUsuario.deleteMany({
      where: { usuarioId: parseInt(id) },
    });

    // Asignar nuevos permisos
    if (modulos && Array.isArray(modulos)) {
      await Promise.all(
        modulos.map(moduloId =>
          prisma.permisoUsuario.create({
            data: {
              usuarioId: parseInt(id),
              moduloId: parseInt(moduloId),
              acceso: true,
            },
          })
        )
      );
    }

    res.redirect('/configuracion/usuarios?success=' + encodeURIComponent('Usuario actualizado exitosamente'));
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.redirect(`/configuracion/usuarios/${req.params.id}/edit?error=` + encodeURIComponent('Error al actualizar usuario'));
  }
};

// Eliminar usuario
const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir eliminar al usuario actual
    if (parseInt(id) === req.session.user.id) {
      return res.redirect('/configuracion/usuarios?error=' + encodeURIComponent('No puedes eliminar tu propio usuario'));
    }

    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
    });

    if (!usuario) {
      return res.redirect('/configuracion/usuarios?error=' + encodeURIComponent('Usuario no encontrado'));
    }

    // Eliminar usuario (los permisos se eliminan en cascada)
    await prisma.usuario.delete({
      where: { id: parseInt(id) },
    });

    res.redirect('/configuracion/usuarios?success=' + encodeURIComponent('Usuario eliminado exitosamente'));
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.redirect('/configuracion/usuarios?error=' + encodeURIComponent('Error al eliminar usuario'));
  }
};

module.exports = {
  index,
  create,
  store,
  edit,
  update,
  destroy,
};

