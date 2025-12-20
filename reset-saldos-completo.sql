-- Script completo para resetear saldos y forzar solicitud de saldo inicial
-- Este script elimina todos los cortes y saldos iniciales del día actual

-- Paso 1: Ver cuántos registros hay antes de eliminar
SELECT 
    'Registros ANTES de eliminar' AS paso,
    COUNT(*) AS cantidad,
    GROUP_CONCAT(CONCAT('ID: ', id, ' - Hora: ', IFNULL(hora, 'Saldo Inicial'), ' - Fecha: ', fecha) SEPARATOR '; ') AS detalles
FROM cortes_caja 
WHERE DATE(fecha) = CURDATE();

-- Paso 2: Eliminar todos los registros de cortes_caja del día actual
DELETE FROM cortes_caja 
WHERE DATE(fecha) = CURDATE();

-- Paso 3: Verificar que se eliminaron los registros
SELECT 
    'Registros DESPUÉS de eliminar' AS paso,
    COUNT(*) AS registros_restantes_hoy
FROM cortes_caja 
WHERE DATE(fecha) = CURDATE();

-- Paso 4: Mostrar resumen final
SELECT 
    '✅ Reseteo completado' AS estado,
    'Todos los cortes y saldos iniciales del día actual han sido eliminados.' AS mensaje,
    'El sistema ahora pedirá ingresar un nuevo saldo inicial cuando accedas a /pos' AS accion;

