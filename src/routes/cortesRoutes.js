const express = require('express');
const router = express.Router();
const cortesController = require('../controllers/cortesController');
const { isAuthenticated, hasModuleAccess } = require('../middleware/auth');

// Rutas de cortes de caja
router.get('/', isAuthenticated, hasModuleAccess('/cortes'), cortesController.index);
router.get('/historial', isAuthenticated, hasModuleAccess('/cortes'), cortesController.historial);
router.get('/:id/reporte', isAuthenticated, cortesController.reporte); // Debe ir antes de /:id
router.get('/:id', isAuthenticated, cortesController.show);
router.post('/', isAuthenticated, cortesController.store);

module.exports = router;


