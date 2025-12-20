-- CreateTable
CREATE TABLE IF NOT EXISTS `categorias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `color` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categorias_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `servicios` ADD COLUMN `categoriaId` INTEGER NULL,
ADD COLUMN `categoriaTexto` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `servicios` ADD CONSTRAINT `servicios_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `categorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Insertar categorías iniciales
INSERT INTO `categorias` (`nombre`, `descripcion`, `color`, `activo`, `createdAt`, `updatedAt`) VALUES
('General', 'Servicios generales de odontología', '#3b82f6', true, NOW(), NOW()),
('Estético', 'Servicios de estética dental', '#ec4899', true, NOW(), NOW()),
('Cirugía', 'Procedimientos quirúrgicos', '#ef4444', true, NOW(), NOW()),
('Ortodoncia', 'Tratamientos de ortodoncia', '#8b5cf6', true, NOW(), NOW()),
('Preventivo', 'Servicios preventivos y limpieza', '#10b981', true, NOW(), NOW()),
('Restaurativo', 'Restauraciones y empastes', '#f59e0b', true, NOW(), NOW()),
('Endodoncia', 'Tratamientos de endodoncia', '#6366f1', true, NOW(), NOW()),
('Periodoncia', 'Tratamientos periodontales', '#14b8a6', true, NOW(), NOW());




