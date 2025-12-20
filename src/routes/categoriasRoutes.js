const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categoriasController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Listar categorías
router.get('/', isAuthenticated, isAdmin, categoriasController.index);

// Mostrar formulario crear/editar
router.get('/crear', isAuthenticated, isAdmin, categoriasController.create);
router.get('/editar/:id', isAuthenticated, isAdmin, categoriasController.create);

// Guardar categoría (crear o actualizar)
router.post('/', isAuthenticated, isAdmin, categoriasController.store);

// Eliminar categoría
router.delete('/:id', isAuthenticated, isAdmin, categoriasController.destroy);

module.exports = router;




