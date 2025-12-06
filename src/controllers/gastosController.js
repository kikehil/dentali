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
      // Por defecto, últimos 30 días
      fechaInicioDate = moment().tz(config.timezone).subtract(30, 'days').startOf('day').toDate();
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

    res.render('gastos/index', {
      title: 'Gestión de Gastos',
      gastos,
      totalGastos,
      totalPorMetodo,
      fechaInicio: fechaInicio || moment().subtract(30, 'days').format('YYYY-MM-DD'),
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
    const { motivo, monto, metodoPago, observaciones } = req.body;

    // Validaciones
    if (!motivo || !monto) {
      return res.status(400).json({ error: 'Motivo y monto son requeridos' });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    const gasto = await prisma.gasto.create({
      data: {
        motivo,
        monto: montoNum,
        metodoPago: metodoPago || 'efectivo',
        observaciones: observaciones || null,
        usuarioId: req.session.user?.id || null,
      },
    });

    res.json({ success: true, gastoId: gasto.id });
  } catch (error) {
    console.error('Error al guardar gasto:', error);
    res.status(500).json({ error: 'Error al guardar gasto' });
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
      // Por defecto, últimos 30 días
      fechaInicioDate = moment().tz(config.timezone).subtract(30, 'days').startOf('day').toDate();
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
    doc.text('Motivo', margin + 100, yPos);
    doc.text('Monto', margin + 350, yPos);
    doc.text('Método', margin + 450, yPos);
    yPos += rowHeight;

    // Línea separadora
    doc.moveTo(margin, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    // Gastos
    gastos.forEach((gasto) => {
      if (yPos > pageHeight - margin - rowHeight) {
        doc.addPage();
        yPos = margin;
      }

      doc.text(moment(gasto.createdAt).format('DD/MM/YYYY'), margin, yPos);
      doc.text(gasto.motivo.substring(0, 30), margin + 100, yPos);
      doc.text(`$${parseFloat(gasto.monto).toFixed(2)}`, margin + 350, yPos);
      doc.text(gasto.metodoPago, margin + 450, yPos);
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

