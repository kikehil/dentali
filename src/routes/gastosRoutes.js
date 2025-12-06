const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastosController');
const { isAuthenticated } = require('../middleware/auth');

// Rutas de gastos
router.get('/', isAuthenticated, gastosController.index);
router.get('/crear', isAuthenticated, gastosController.create);
router.post('/', isAuthenticated, gastosController.store);
router.get('/reporte', isAuthenticated, gastosController.reporte);

module.exports = router;


