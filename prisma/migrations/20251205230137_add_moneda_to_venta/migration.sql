-- Agregar campo moneda a la tabla ventas
ALTER TABLE `ventas` 
  ADD COLUMN `moneda` VARCHAR(191) NOT NULL DEFAULT 'MXN' AFTER `banco`;














