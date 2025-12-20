const express = require('express');
const router = express.Router();
const configuracionController = require('../controllers/configuracionController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Página principal de configuración (solo admin)
router.get('/', isAuthenticated, isAdmin, configuracionController.index);

// Configuración de cortes (solo admin)
router.get('/cortes', isAuthenticated, isAdmin, configuracionController.mostrarConfiguracionCortes);
router.post('/cortes', isAuthenticated, isAdmin, configuracionController.actualizarConfiguracionCortes);

// Configuración de tipo de cambio (solo admin)
router.get('/tipo-cambio', isAuthenticated, isAdmin, configuracionController.tipoCambio);
router.post('/tipo-cambio', isAuthenticated, isAdmin, configuracionController.updateTipoCambio);

// Servicios y Productos (solo admin)
const posController = require('../controllers/posController');
router.get('/servicios', isAuthenticated, isAdmin, posController.servicios);
router.post('/servicios', isAuthenticated, isAdmin, posController.saveServicio);
router.get('/productos', isAuthenticated, isAdmin, posController.productos);
router.post('/productos', isAuthenticated, isAdmin, posController.saveProducto);

// Categorías (solo admin)
router.use('/categorias', require('./categoriasRoutes'));

// Usuarios (solo admin)
router.use('/usuarios', require('./usuariosRoutes'));

module.exports = router;

