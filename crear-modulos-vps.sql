-- Script SQL para crear módulos directamente en el VPS
-- Ejecutar: mysql -u [usuario] -p [base_de_datos] < crear-modulos-vps.sql

-- Crear tabla modulos si no existe
CREATE TABLE IF NOT EXISTS modulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  descripcion TEXT,
  ruta VARCHAR(255),
  icono VARCHAR(255),
  activo BOOLEAN DEFAULT TRUE,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla permisos_usuarios si no existe
CREATE TABLE IF NOT EXISTS permisos_usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT NOT NULL,
  moduloId INT NOT NULL,
  acceso BOOLEAN DEFAULT TRUE,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY unique_usuario_modulo (usuarioId, moduloId),
  FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (moduloId) REFERENCES modulos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar módulos si no existen
INSERT IGNORE INTO modulos (nombre, descripcion, ruta, icono, activo, createdAt, updatedAt) VALUES
('Punto de Venta', 'Módulo para realizar ventas y cobros', '/pos', 'fas fa-cash-register', true, NOW(), NOW()),
('Pacientes', 'Gestión de pacientes', '/pacientes', 'fas fa-user-injured', true, NOW(), NOW()),
('Doctores', 'Gestión de doctores', '/doctores', 'fas fa-user-md', true, NOW(), NOW()),
('Historial Ventas', 'Ver historial de ventas realizadas', '/pos/ventas', 'fas fa-history', true, NOW(), NOW()),
('Cortes de Caja', 'Realizar y ver cortes de caja', '/cortes', 'fas fa-cut', true, NOW(), NOW()),
('Gastos', 'Registrar y gestionar gastos', '/gastos', 'fas fa-money-bill-wave', true, NOW(), NOW()),
('Configuración', 'Configuración del sistema', '/configuracion', 'fas fa-cog', true, NOW(), NOW());

