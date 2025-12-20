const config = require('../config/config');
const prisma = require('../config/database');

// Verificar si el usuario está autenticado
const isAuthenticated = async (req, res, next) => {
  console.log('=== MIDDLEWARE isAuthenticated ===');
  console.log('Session existe:', !!req.session);
  console.log('Session user:', req.session?.user ? JSON.stringify(req.session.user) : 'No hay usuario');
  console.log('URL:', req.url);
  
  if (req.session && req.session.user) {
    // Cargar permisos del usuario si no están en la sesión
    if (!req.session.user.permisos) {
      try {
        const permisos = await prisma.permisoUsuario.findMany({
          where: {
            usuarioId: req.session.user.id,
            acceso: true,
          },
          include: {
            modulo: true,
          },
        });
        req.session.user.permisos = permisos.map(p => ({
          moduloId: p.moduloId,
          moduloNombre: p.modulo.nombre,
          ruta: p.modulo.ruta,
        }));
      } catch (error) {
        console.error('Error al cargar permisos:', error);
      }
    }
    console.log('Usuario autenticado, permitiendo acceso');
    return next();
  }
  console.log('Usuario NO autenticado, redirigiendo a login');
  res.redirect('/login');
};

// Verificar si el usuario NO está autenticado (para login)
const isNotAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// Verificar roles específicos
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    
    if (roles.includes(req.session.user.rol)) {
      return next();
    }
    
    res.status(403).render('error', {
      title: 'Acceso Denegado',
      message: 'No tienes permisos para acceder a esta sección',
      error: { status: 403 },
    });
  };
};

// Verificar si es administrador
const isAdmin = hasRole(config.roles.ADMIN);

// Verificar si es administrador o doctor
const isAdminOrDoctor = hasRole(config.roles.ADMIN, config.roles.DOCTOR);

// Verificar si puede gestionar pacientes (todos los roles)
const canManagePatients = hasRole(
  config.roles.ADMIN,
  config.roles.DOCTOR,
  config.roles.RECEPCIONISTA
);

// Verificar acceso a un módulo específico
const hasModuleAccess = (rutaModulo) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    // Los administradores tienen acceso a todo
    if (req.session.user.rol === config.roles.ADMIN) {
      return next();
    }

    // Cargar permisos si no están en la sesión
    if (!req.session.user.permisos) {
      try {
        const permisos = await prisma.permisoUsuario.findMany({
          where: {
            usuarioId: req.session.user.id,
            acceso: true,
          },
          include: {
            modulo: true,
          },
        });
        req.session.user.permisos = permisos.map(p => ({
          moduloId: p.moduloId,
          moduloNombre: p.modulo.nombre,
          ruta: p.modulo.ruta,
        }));
      } catch (error) {
        console.error('Error al cargar permisos:', error);
        return res.status(500).render('error', {
          title: 'Error',
          message: 'Error al verificar permisos',
          error,
        });
      }
    }

    // Verificar si el usuario tiene acceso al módulo
    // Comparar la ruta del módulo con la ruta actual de la petición
    const tieneAcceso = req.session.user.permisos.some(
      permiso => {
        if (!permiso.ruta) return false;
        // Verificar si la ruta actual coincide con la ruta del módulo
        // o si la ruta del módulo coincide con el parámetro pasado
        const rutaActual = req.path;
        const rutaModuloPermiso = permiso.ruta;
        
        // Casos especiales: /pos incluye /pos/ventas
        if (rutaModuloPermiso === '/pos' && (rutaActual.startsWith('/pos') || rutaModulo === '/pos')) {
          return true;
        }
        
        // Verificación normal
        return rutaActual.startsWith(rutaModuloPermiso) || 
               rutaModuloPermiso === rutaModulo ||
               (rutaModulo && rutaActual.startsWith(rutaModulo));
      }
    );

    if (tieneAcceso) {
      return next();
    }

    res.status(403).render('error', {
      title: 'Acceso Denegado',
      message: 'No tienes permisos para acceder a este módulo. Contacta al administrador para solicitar acceso.',
      error: { status: 403 },
    });
  };
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  hasRole,
  isAdmin,
  isAdminOrDoctor,
  canManagePatients,
  hasModuleAccess,
};

