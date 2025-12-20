# Migración: Sistema de Control de Usuarios y Permisos

## Pasos para implementar el sistema de control de usuarios

### 1. Ejecutar migración de Prisma

```bash
npx prisma migrate dev --name add_modulos_and_permisos
```

Esto creará las tablas:
- `modulos`: Define los módulos del sistema
- `permisos_usuarios`: Relación entre usuarios y módulos con permisos

### 2. Inicializar módulos del sistema

```bash
node scripts/init-modulos.js
```

Esto creará los siguientes módulos:
- Punto de Venta
- Pacientes
- Doctores
- Historial Ventas
- Cortes de Caja
- Gastos
- Configuración

### 3. Reiniciar el servidor

```bash
npm start
# o
pm2 restart all
```

## Funcionalidades

### Control de Usuarios
- **Listar usuarios**: Ver todos los usuarios con sus permisos
- **Crear usuario**: Crear nuevo usuario y asignar módulos
- **Editar usuario**: Modificar datos y permisos
- **Eliminar usuario**: Eliminar usuarios (no se puede eliminar a sí mismo)

### Asignación de Permisos
- Cada usuario puede tener acceso a uno o más módulos
- Los permisos se asignan mediante checkboxes en el formulario
- Solo los administradores pueden gestionar usuarios y permisos

## Uso

1. Acceder a **Configuración > Control de Usuarios**
2. Crear o editar un usuario
3. Seleccionar los módulos a los que tendrá acceso
4. Guardar los cambios

## Notas

- Los administradores tienen acceso completo a todos los módulos automáticamente
- Los permisos se verifican en el middleware (pendiente de implementar)
- Los módulos se pueden activar/desactivar desde la base de datos

