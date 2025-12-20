-- Agregar nuevos campos a la tabla cortes_caja
ALTER TABLE `cortes_caja` 
  ADD COLUMN `saldoInicialEfectivo` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `hora`,
  ADD COLUMN `saldoInicialTarjeta` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoInicialEfectivo`,
  ADD COLUMN `saldoInicialTransferencia` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoInicialTarjeta`,
  ADD COLUMN `ventasTarjetaAzteca` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `ventasTransferencia`,
  ADD COLUMN `ventasTarjetaBBVA` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `ventasTarjetaAzteca`,
  ADD COLUMN `ventasTarjetaMP` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `ventasTarjetaBBVA`,
  ADD COLUMN `saldoFinalEfectivo` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `totalVentas`,
  ADD COLUMN `saldoFinalTarjeta` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoFinalEfectivo`,
  ADD COLUMN `saldoFinalTransferencia` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoFinalTarjeta`;

-- Actualizar campos existentes: hacer hora nullable si no lo es
ALTER TABLE `cortes_caja` MODIFY COLUMN `hora` VARCHAR(191) NULL;

-- Agregar campo banco a la tabla ventas
ALTER TABLE `ventas` ADD COLUMN `banco` VARCHAR(191) NULL AFTER `metodoPago`;

-- Crear tabla configuracion_tipo_cambio
CREATE TABLE IF NOT EXISTS `configuracion_tipo_cambio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipoCambio` DECIMAL(10, 4) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear tabla gastos
CREATE TABLE IF NOT EXISTS `gastos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `motivo` VARCHAR(191) NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `metodoPago` VARCHAR(191) NOT NULL DEFAULT 'efectivo',
    `observaciones` TEXT NULL,
    `usuarioId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `gastos_usuarioId_idx` (`usuarioId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Agregar foreign key para gastos
ALTER TABLE `gastos` ADD CONSTRAINT `gastos_usuarioId_fkey` 
  FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;















