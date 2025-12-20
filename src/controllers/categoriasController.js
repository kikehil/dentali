const prisma = require('../config/database');

// Listar todas las categorías
const index = async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
    });

    res.render('categorias/index', {
      title: 'Gestión de Categorías',
      categorias,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar categorías:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar categorías',
      error,
    });
  }
};

// Mostrar formulario de crear/editar
const create = async (req, res) => {
  try {
    const { id } = req.params;
    let categoria = null;

    if (id) {
      categoria = await prisma.categoria.findUnique({
        where: { id: parseInt(id) },
      });

      if (!categoria) {
        return res.redirect('/configuracion/categorias?error=Categoría no encontrada');
      }
    }

    res.render('categorias/crear', {
      title: id ? 'Editar Categoría' : 'Nueva Categoría',
      categoria,
    });
  } catch (error) {
    console.error('Error al cargar formulario de categoría:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar formulario',
      error,
    });
  }
};

// Guardar categoría (crear o actualizar)
const store = async (req, res) => {
  try {
    const { id, nombre, descripcion, color, activo } = req.body;

    // Validaciones
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const data = {
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      color: color || null,
      activo: activo === 'true' || activo === true,
    };

    if (id) {
      // Actualizar
      await prisma.categoria.update({
        where: { id: parseInt(id) },
        data,
      });
      res.json({ success: true, message: 'Categoría actualizada correctamente' });
    } else {
      // Crear
      await prisma.categoria.create({ data });
      res.json({ success: true, message: 'Categoría creada correctamente' });
    }
  } catch (error) {
    console.error('Error al guardar categoría:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    
    res.status(500).json({ error: 'Error al guardar categoría' });
  }
};

// Eliminar categoría
const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si hay servicios usando esta categoría
    const serviciosConCategoria = await prisma.servicio.count({
      where: { categoriaId: parseInt(id) },
    });

    if (serviciosConCategoria > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar la categoría porque tiene ${serviciosConCategoria} servicio(s) asociado(s)` 
      });
    }

    await prisma.categoria.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

module.exports = {
  index,
  create,
  store,
  destroy,
};




