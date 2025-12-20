const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const moment = require('moment-timezone');
const config = require('../config/config');

// Mostrar página de login
const showLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Iniciar Sesión',
    error: null,
  });
};

// Procesar login
const processLogin = async (req, res) => {
  try {
    console.log('Login attempt - Body:', req.body);
    console.log('Login attempt - Email:', req.body?.email);
    console.log('Login attempt - Password:', req.body?.password ? '***' : 'undefined');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: 'Email y contraseña son requeridos',
      });
    }

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { doctor: true },
    });

    if (!usuario) {
      console.log('Usuario no encontrado');
      return res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: 'Credenciales incorrectas',
      });
    }

    console.log('Verificando contraseña...');
    // Verificar contraseña
    const isValid = await bcrypt.compare(password, usuario.password);
    console.log('Contraseña válida:', isValid);
    if (!isValid) {
      console.log('Contraseña incorrecta');
      return res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: 'Credenciales incorrectas',
      });
    }

    // Verificar si está activo
    if (!usuario.activo) {
      console.log('Usuario inactivo');
      return res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: 'Tu cuenta está desactivada',
      });
    }

    console.log('Creando sesión...');
    
    // Cargar permisos del usuario
    let permisos = [];
    if (usuario.rol !== 'admin') {
      // Los administradores tienen acceso a todo, no necesitan permisos específicos
      const permisosUsuario = await prisma.permisoUsuario.findMany({
        where: {
          usuarioId: usuario.id,
          acceso: true,
        },
        include: {
          modulo: true,
        },
      });
      permisos = permisosUsuario.map(p => ({
        moduloId: p.moduloId,
        moduloNombre: p.modulo.nombre,
        ruta: p.modulo.ruta,
      }));
    }
    
    // Crear sesión
    req.session.user = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      doctorId: usuario.doctorId,
      permisos: permisos,
    };
    console.log('Sesión creada para usuario:', usuario.email, 'Rol:', usuario.rol, 'Permisos:', permisos.length);

    // Verificar si es admin o recepcionista y si necesita saldo inicial
    // Solo para admin y recepcionista, verificar si es el primer inicio del día
    if ((usuario.rol === 'admin' || usuario.rol === 'recepcionista')) {
      console.log('Verificando saldo inicial para admin/recepcionista...');
      try {
        const hoy = moment().tz(config.timezone).startOf('day').toDate();
        const mañana = moment().tz(config.timezone).endOf('day').toDate();
        const ayer = moment().tz(config.timezone).subtract(1, 'day').startOf('day').toDate();
        const finAyer = moment().tz(config.timezone).subtract(1, 'day').endOf('day').toDate();
        
        console.log('Buscando saldo inicial de hoy...');
        // Verificar si hay saldo inicial hoy
        const saldoInicialHoy = await prisma.corteCaja.findFirst({
          where: {
            fecha: { gte: hoy, lte: mañana },
            hora: null, // Saldo inicial no tiene hora
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        console.log('Saldo inicial hoy:', saldoInicialHoy ? 'Encontrado' : 'No encontrado');

        // Verificar si ayer hubo algún corte (automático o manual)
        const corteAyer = await prisma.corteCaja.findFirst({
          where: {
            fecha: { gte: ayer, lte: finAyer },
            hora: { not: null }, // Cualquier corte con hora (automático o manual)
          },
          orderBy: { createdAt: 'desc' },
        });

        console.log('Corte ayer:', corteAyer ? 'Encontrado' : 'No encontrado');

        // Si no hay saldo inicial hoy, necesita saldo inicial en estos casos:
        // 1. Si ayer hubo algún corte (automático o manual) - después de cualquier corte se necesita saldo inicial
        // 2. Si es el primer día y no hay saldo inicial
        if (!saldoInicialHoy) {
          console.log('Redirigiendo a POS para saldo inicial...');
          // Guardar sesión explícitamente antes de redirigir
          console.log('Guardando sesión antes de redirigir...');
          console.log('Sesión antes de guardar:', JSON.stringify(req.session.user));
          
          // Usar await para asegurar que la sesión se guarde
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error('Error al guardar sesión:', err);
                reject(err);
              } else {
                console.log('Sesión guardada exitosamente');
                console.log('Sesión después de guardar:', JSON.stringify(req.session.user));
                resolve();
              }
            });
          });
          
          console.log('Redirigiendo a /pos?necesitaSaldoInicial=true');
          return res.redirect('/pos?necesitaSaldoInicial=true');
        }
        console.log('Saldo inicial OK, continuando al dashboard...');
      } catch (corteError) {
        // Si hay error al consultar cortes, simplemente continuar al dashboard
        // No bloquear el login por un error en la verificación de cortes
        console.error('Error al verificar cortes en login (no crítico):', corteError);
      }
    } else {
      console.log('Usuario no es admin/recepcionista, redirigiendo directamente al dashboard...');
    }

    console.log('Redirigiendo al dashboard...');
    // Guardar sesión explícitamente antes de redirigir
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Error al guardar sesión:', err);
          reject(err);
        } else {
          console.log('Sesión guardada para dashboard');
          resolve();
        }
      });
    });
    
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Error en login:', error);
    res.render('auth/login', {
      title: 'Iniciar Sesión',
      error: 'Error al iniciar sesión',
    });
  }
};

// Cerrar sesión
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
    }
    res.redirect('/login');
  });
};

// Mostrar perfil
const showProfile = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.session.user.id },
      include: { doctor: true },
    });

    res.render('auth/perfil', {
      title: 'Mi Perfil',
      usuario,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.redirect('/dashboard');
  }
};

// Actualizar perfil
const updateProfile = async (req, res) => {
  try {
    const { nombre, email, currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    // Si quiere cambiar contraseña
    if (newPassword) {
      const isValid = await bcrypt.compare(currentPassword, usuario.password);
      if (!isValid) {
        return res.redirect('/perfil?error=Contraseña actual incorrecta');
      }
    }

    // Actualizar datos
    const updateData = { nombre, email };
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    await prisma.usuario.update({
      where: { id: userId },
      data: updateData,
    });

    // Actualizar sesión
    req.session.user.nombre = nombre;
    req.session.user.email = email;

    res.redirect('/perfil?success=Perfil actualizado correctamente');
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.redirect('/perfil?error=Error al actualizar perfil');
  }
};

module.exports = {
  showLogin,
  processLogin,
  logout,
  showProfile,
  updateProfile,
};

