-- Agregar campo doctorId a la tabla ventas
ALTER TABLE `ventas` 
  ADD COLUMN `doctorId` INTEGER NULL AFTER `pacienteId`;

-- Agregar índice para mejorar rendimiento
CREATE INDEX `ventas_doctorId_idx` ON `ventas`(`doctorId`);

-- Agregar foreign key constraint
ALTER TABLE `ventas` 
  ADD CONSTRAINT `ventas_doctorId_fkey` 
  FOREIGN KEY (`doctorId`) REFERENCES `doctores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;














