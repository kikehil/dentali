const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación y ser admin
router.get('/', isAuthenticated, isAdmin, usuariosController.index);
router.get('/create', isAuthenticated, isAdmin, usuariosController.create);
router.post('/create', isAuthenticated, isAdmin, usuariosController.store);
router.get('/:id/edit', isAuthenticated, isAdmin, usuariosController.edit);
router.post('/:id/update', isAuthenticated, isAdmin, usuariosController.update);
router.post('/:id/delete', isAuthenticated, isAdmin, usuariosController.destroy);

module.exports = router;

