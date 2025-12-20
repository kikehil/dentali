const prisma = require('../config/database');
const moment = require('moment-timezone');
const config = require('../config/config');
const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../utils/helpers');

// Lista de gastos
const index = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let fechaInicioDate, fechaFinDate;
    
    if (fechaInicio && fechaFin) {
      fechaInicioDate = moment(fechaInicio, 'YYYY-MM-DD').tz(config.timezone).startOf('day').toDate();
      fechaFinDate = moment(fechaFin, 'YYYY-MM-DD').tz(config.timezone).endOf('day').toDate();
    } else {
      // Por defecto, solo el día actual
      fechaInicioDate = moment().tz(config.timezone).startOf('day').toDate();
      fechaFinDate = moment().tz(config.timezone).endOf('day').toDate();
    }

    const gastos = await prisma.gasto.findMany({
      where: {
        createdAt: { gte: fechaInicioDate, lte: fechaFinDate },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calcular totales
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const totalPorMetodo = {
      efectivo: gastos
        .filter(g => g.metodoPago === 'efectivo')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      tarjeta: gastos
        .filter(g => g.metodoPago === 'tarjeta')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      transferencia: gastos
        .filter(g => g.metodoPago === 'transferencia')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
    };

    // Calcular totales por método y banco
    const totalPorMetodoYBanco = {
      efectivo: {
        total: totalPorMetodo.efectivo,
        desglose: {}
      },
      tarjeta: {
        total: totalPorMetodo.tarjeta,
        desglose: {
          'Azteca': gastos
            .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'Azteca')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
          'BBVA': gastos
            .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'BBVA')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
          'Mercado Pago': gastos
            .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'Mercado Pago')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        }
      },
      transferencia: {
        total: totalPorMetodo.transferencia,
        desglose: {
          'Azteca': gastos
            .filter(g => g.metodoPago === 'transferencia' && g.banco === 'Azteca')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
          'BBVA': gastos
            .filter(g => g.metodoPago === 'transferencia' && g.banco === 'BBVA')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
          'Mercado Pago': gastos
            .filter(g => g.metodoPago === 'transferencia' && g.banco === 'Mercado Pago')
            .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        }
      }
    };

    res.render('gastos/index', {
      title: 'Gestión de Gastos',
      gastos,
      totalGastos,
      totalPorMetodo,
      totalPorMetodoYBanco,
      fechaInicio: fechaInicio || moment().format('YYYY-MM-DD'),
      fechaFin: fechaFin || moment().format('YYYY-MM-DD'),
      success: req.query.success,
      error: req.query.error,
      formatCurrency,
    });
  } catch (error) {
    console.error('Error al cargar gastos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar gastos',
      error,
    });
  }
};

// Mostrar formulario crear gasto
const create = async (req, res) => {
  try {
    res.render('gastos/crear', {
      title: 'Registrar Gasto',
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Error al cargar formulario de gasto:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar formulario',
      error,
    });
  }
};

// Guardar gasto
const store = async (req, res) => {
  try {
    const { motivo, monto, metodoPago, banco, observaciones } = req.body;

    // Validaciones
    if (!motivo || !monto) {
      return res.status(400).json({ error: 'Motivo y monto son requeridos' });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    // Validar que si es tarjeta o transferencia, debe tener banco
    if ((metodoPago === 'tarjeta' || metodoPago === 'transferencia') && !banco) {
      return res.status(400).json({ error: 'Debe seleccionar un banco para este método de pago' });
    }

    // Crear el gasto
    const gasto = await prisma.gasto.create({
      data: {
        motivo,
        monto: montoNum,
        metodoPago: metodoPago || 'efectivo',
        banco: (metodoPago === 'tarjeta' || metodoPago === 'transferencia') ? banco : null,
        observaciones: observaciones || null,
        usuarioId: req.session.user?.id || null,
      },
    });

    // Si el gasto es con tarjeta o transferencia, descontar del saldo del banco correspondiente
    if ((metodoPago === 'tarjeta' || metodoPago === 'transferencia') && banco) {
      const hoy = moment().tz(config.timezone).startOf('day').toDate();
      const mañana = moment().tz(config.timezone).endOf('day').toDate();

      // Buscar el último corte de caja del día actual
      const ultimoCorte = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (ultimoCorte) {
        // Actualizar el saldo del banco correspondiente
        const updateData = {};
        
        if (metodoPago === 'tarjeta') {
          if (banco === 'Azteca') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) - montoNum;
            updateData.saldoFinalTarjetaAzteca = nuevoSaldo;
            // Actualizar también el saldo total de tarjeta
            const saldoTarjetaTotal = nuevoSaldo + 
              parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
          } else if (banco === 'BBVA') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) - montoNum;
            updateData.saldoFinalTarjetaBbva = nuevoSaldo;
            const saldoTarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) + 
              nuevoSaldo + 
              parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
          } else if (banco === 'Mercado Pago') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0) - montoNum;
            updateData.saldoFinalTarjetaMp = nuevoSaldo;
            const saldoTarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) + 
              nuevoSaldo;
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
          }
        } else if (metodoPago === 'transferencia') {
          // Descontar del banco específico de transferencia
          if (banco === 'Azteca') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTransferenciaAzteca || 0) - montoNum;
            updateData.saldoFinalTransferenciaAzteca = nuevoSaldo;
            // Actualizar también el saldo total de transferencia
            const saldoTransferenciaTotal = nuevoSaldo + 
              parseFloat(ultimoCorte.saldoFinalTransferenciaBbva || 0) + 
              parseFloat(ultimoCorte.saldoFinalTransferenciaMp || 0);
            updateData.saldoFinalTransferencia = saldoTransferenciaTotal;
            const saldoTarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              saldoTransferenciaTotal;
          } else if (banco === 'BBVA') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTransferenciaBbva || 0) - montoNum;
            updateData.saldoFinalTransferenciaBbva = nuevoSaldo;
            const saldoTransferenciaTotal = parseFloat(ultimoCorte.saldoFinalTransferenciaAzteca || 0) + 
              nuevoSaldo + 
              parseFloat(ultimoCorte.saldoFinalTransferenciaMp || 0);
            updateData.saldoFinalTransferencia = saldoTransferenciaTotal;
            const saldoTarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              saldoTransferenciaTotal;
          } else if (banco === 'Mercado Pago') {
            const nuevoSaldo = parseFloat(ultimoCorte.saldoFinalTransferenciaMp || 0) - montoNum;
            updateData.saldoFinalTransferenciaMp = nuevoSaldo;
            const saldoTransferenciaTotal = parseFloat(ultimoCorte.saldoFinalTransferenciaAzteca || 0) + 
              parseFloat(ultimoCorte.saldoFinalTransferenciaBbva || 0) + 
              nuevoSaldo;
            updateData.saldoFinalTransferencia = saldoTransferenciaTotal;
            const saldoTarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) + 
              parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
            updateData.saldoFinal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0) + 
              saldoTarjetaTotal + 
              saldoTransferenciaTotal;
          }
        }

        // Actualizar el último corte con los nuevos saldos
        await prisma.corteCaja.update({
          where: { id: ultimoCorte.id },
          data: updateData,
        });
      }
    }

    res.json({ success: true, gastoId: gasto.id });
  } catch (error) {
    console.error('Error al guardar gasto:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al guardar gasto',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Generar reporte de gastos
const reporte = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let fechaInicioDate, fechaFinDate;
    
    if (fechaInicio && fechaFin) {
      fechaInicioDate = moment(fechaInicio, 'YYYY-MM-DD').tz(config.timezone).startOf('day').toDate();
      fechaFinDate = moment(fechaFin, 'YYYY-MM-DD').tz(config.timezone).endOf('day').toDate();
    } else {
      // Por defecto, solo el día actual
      fechaInicioDate = moment().tz(config.timezone).startOf('day').toDate();
      fechaFinDate = moment().tz(config.timezone).endOf('day').toDate();
    }

    const gastos = await prisma.gasto.findMany({
      where: {
        createdAt: { gte: fechaInicioDate, lte: fechaFinDate },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calcular totales
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const totalPorMetodo = {
      efectivo: gastos
        .filter(g => g.metodoPago === 'efectivo')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      tarjeta: gastos
        .filter(g => g.metodoPago === 'tarjeta')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      transferencia: gastos
        .filter(g => g.metodoPago === 'transferencia')
        .reduce((sum, g) => sum + parseFloat(g.monto), 0),
    };

    // Calcular totales por método y banco para el reporte
    const totalPorMetodoYBancoReporte = {
      tarjeta: {
        'Azteca': gastos
          .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'Azteca')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        'BBVA': gastos
          .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'BBVA')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        'Mercado Pago': gastos
          .filter(g => g.metodoPago === 'tarjeta' && g.banco === 'Mercado Pago')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      },
      transferencia: {
        'Azteca': gastos
          .filter(g => g.metodoPago === 'transferencia' && g.banco === 'Azteca')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        'BBVA': gastos
          .filter(g => g.metodoPago === 'transferencia' && g.banco === 'BBVA')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
        'Mercado Pago': gastos
          .filter(g => g.metodoPago === 'transferencia' && g.banco === 'Mercado Pago')
          .reduce((sum, g) => sum + parseFloat(g.monto), 0),
      }
    };

    // Crear documento PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_gastos_${moment().format('YYYY-MM-DD')}.pdf"`);

    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).text(config.clinica.nombre, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Reporte de Gastos', { align: 'center' });
    doc.moveDown();

    // Período
    doc.fontSize(12);
    doc.text(`Período: ${moment(fechaInicioDate).format('DD/MM/YYYY')} - ${moment(fechaFinDate).format('DD/MM/YYYY')}`);
    doc.moveDown();

    // Tabla de gastos
    doc.fontSize(14).text('Detalle de Gastos', { underline: true });
    doc.moveDown();

    let yPos = doc.y;
    const startY = yPos;
    const pageHeight = doc.page.height;
    const margin = 50;
    const rowHeight = 20;

    // Encabezados de tabla
    doc.fontSize(10);
    doc.text('Fecha', margin, yPos);
    doc.text('Motivo', margin + 80, yPos);
    doc.text('Monto', margin + 280, yPos);
    doc.text('Método', margin + 350, yPos);
    doc.text('Banco', margin + 420, yPos);
    yPos += rowHeight;

    // Línea separadora
    doc.moveTo(margin, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    // Gastos
    gastos.forEach((gasto) => {
      if (yPos > pageHeight - margin - rowHeight) {
        doc.addPage();
        yPos = margin;
        // Reimprimir encabezados en nueva página
        doc.text('Fecha', margin, yPos);
        doc.text('Motivo', margin + 80, yPos);
        doc.text('Monto', margin + 280, yPos);
        doc.text('Método', margin + 350, yPos);
        doc.text('Banco', margin + 420, yPos);
        yPos += rowHeight;
        doc.moveTo(margin, yPos).lineTo(550, yPos).stroke();
        yPos += 10;
      }

      doc.text(moment(gasto.createdAt).format('DD/MM/YYYY'), margin, yPos);
      doc.text(gasto.motivo.substring(0, 25), margin + 80, yPos);
      doc.text(`$${parseFloat(gasto.monto).toFixed(2)}`, margin + 280, yPos);
      doc.text(gasto.metodoPago, margin + 350, yPos);
      doc.text(gasto.banco || '-', margin + 420, yPos);
      yPos += rowHeight;
    });

    doc.moveDown(2);

    // Totales
    doc.fontSize(12);
    doc.text('Resumen', { underline: true });
    doc.text(`Total Efectivo: $${totalPorMetodo.efectivo.toFixed(2)}`);
    doc.text(`Total Tarjeta: $${totalPorMetodo.tarjeta.toFixed(2)}`);
    doc.text(`Total Transferencia: $${totalPorMetodo.transferencia.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Total General: $${totalGastos.toFixed(2)}`, { underline: true });
    
    doc.moveDown(2);
    
    // Desglose por método y banco
    doc.fontSize(12);
    doc.text('Desglose por Método y Banco', { underline: true });
    doc.moveDown();
    
    // Tarjeta
    if (totalPorMetodo.tarjeta > 0) {
      doc.fontSize(11);
      doc.text('Tarjeta:', { underline: false });
      doc.text(`  Azteca: $${totalPorMetodoYBancoReporte.tarjeta['Azteca'].toFixed(2)}`, { indent: 20 });
      doc.text(`  BBVA: $${totalPorMetodoYBancoReporte.tarjeta['BBVA'].toFixed(2)}`, { indent: 20 });
      doc.text(`  Mercado Pago: $${totalPorMetodoYBancoReporte.tarjeta['Mercado Pago'].toFixed(2)}`, { indent: 20 });
      doc.moveDown();
    }
    
    // Transferencia
    if (totalPorMetodo.transferencia > 0) {
      doc.fontSize(11);
      doc.text('Transferencia:', { underline: false });
      doc.text(`  Azteca: $${totalPorMetodoYBancoReporte.transferencia['Azteca'].toFixed(2)}`, { indent: 20 });
      doc.text(`  BBVA: $${totalPorMetodoYBancoReporte.transferencia['BBVA'].toFixed(2)}`, { indent: 20 });
      doc.text(`  Mercado Pago: $${totalPorMetodoYBancoReporte.transferencia['Mercado Pago'].toFixed(2)}`, { indent: 20 });
    }

    doc.end();
  } catch (error) {
    console.error('Error al generar reporte de gastos:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Error al generar reporte PDF',
      error,
    });
  }
};

module.exports = {
  index,
  create,
  store,
  reporte,
};

