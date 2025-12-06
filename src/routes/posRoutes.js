const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { isAuthenticated } = require('../middleware/auth');

// Punto de venta
router.get('/', isAuthenticated, posController.index);
router.post('/venta', isAuthenticated, posController.processSale);

// Saldo inicial y cortes de caja
router.post('/saldo-inicial', isAuthenticated, posController.guardarSaldoInicial);
router.get('/corte', isAuthenticated, posController.mostrarCorte);
router.post('/corte', isAuthenticated, posController.procesarCorte);
router.post('/verificar-admin', isAuthenticated, posController.verificarPasswordAdmin);
router.get('/corte-manual', isAuthenticated, posController.mostrarCorteManual);
router.post('/corte-manual', isAuthenticated, posController.procesarCorteManual);

// Historial
router.get('/ventas', isAuthenticated, posController.ventas);
router.get('/ventas/:id', isAuthenticated, posController.getVenta);

module.exports = router;

