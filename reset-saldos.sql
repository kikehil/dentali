-- Script para resetear saldos y forzar solicitud de saldo inicial
-- Este script elimina todos los cortes y saldos iniciales del día actual

-- Eliminar todos los registros de cortes_caja del día actual
DELETE FROM cortes_caja 
WHERE DATE(fecha) = CURDATE();

-- Verificar que se eliminaron los registros
SELECT 
    'Registros eliminados del día actual' AS mensaje,
    COUNT(*) AS registros_restantes_hoy
FROM cortes_caja 
WHERE DATE(fecha) = CURDATE();

-- Mostrar resumen
SELECT 
    'Resumen: Todos los cortes y saldos iniciales del día actual han sido eliminados.' AS mensaje,
    'El sistema ahora pedirá ingresar un nuevo saldo inicial.' AS accion;

