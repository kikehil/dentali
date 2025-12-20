-- Agregar campos de saldo final de transferencia por banco
ALTER TABLE `cortes_caja` 
  ADD COLUMN `saldoFinalTransferenciaAzteca` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoFinalTransferencia`,
  ADD COLUMN `saldoFinalTransferenciaBbva` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoFinalTransferenciaAzteca`,
  ADD COLUMN `saldoFinalTransferenciaMp` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `saldoFinalTransferenciaBbva`;







