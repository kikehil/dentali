-- Agregar campo banco a la tabla gastos
ALTER TABLE `gastos` 
  ADD COLUMN `banco` VARCHAR(191) NULL AFTER `metodoPago`;










