const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { isAuthenticated, hasModuleAccess } = require('../middleware/auth');

// Punto de venta
router.get('/', isAuthenticated, hasModuleAccess('/pos'), posController.index);
router.post('/venta', isAuthenticated, posController.processSale);

// Saldo inicial y cortes de caja
router.post('/saldo-inicial', isAuthenticated, posController.guardarSaldoInicial);
router.get('/corte', isAuthenticated, posController.mostrarCorte);
router.post('/corte', isAuthenticated, posController.procesarCorte);
router.post('/verificar-admin', isAuthenticated, posController.verificarPasswordAdmin);
router.get('/corte-manual', isAuthenticated, posController.mostrarCorteManual);
router.post('/corte-manual', isAuthenticated, posController.procesarCorteManual);
router.get('/corte-efectivo', isAuthenticated, posController.mostrarCorteEfectivo);
router.post('/corte-efectivo', isAuthenticated, posController.procesarCorteEfectivo);
router.get('/corte-bancos', isAuthenticated, posController.mostrarCorteBancos);
router.post('/corte-bancos', isAuthenticated, posController.procesarCorteBancos);

// Saldos en tiempo real
router.get('/saldos', isAuthenticated, posController.obtenerSaldosActuales);
router.post('/verificar-password', isAuthenticated, posController.verificarPasswordUsuario);

// Historial
router.get('/ventas', isAuthenticated, hasModuleAccess('/pos/ventas'), posController.ventas);
router.get('/ventas/:id', isAuthenticated, hasModuleAccess('/pos/ventas'), posController.getVenta);

module.exports = router;

