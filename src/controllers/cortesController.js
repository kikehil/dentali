const prisma = require('../config/database');
const moment = require('moment-timezone');
const config = require('../config/config');
const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../utils/helpers');

// Funciones helper para manejar método de pago y banco (compatibles con formato antiguo y nuevo)
const getMetodoBase = (metodoPago) => {
  if (!metodoPago) return 'efectivo';
  const metodo = metodoPago.toLowerCase();
  if (metodo === 'efectivo') return 'efectivo';
  if (metodo.includes('tarjeta') || metodo.includes('mercado pago')) return 'tarjeta';
  if (metodo.includes('transferencia')) return 'transferencia';
  return metodoPago;
};

const getBanco = (v) => {
  if (v.banco) return v.banco;
  const metodo = v.metodoPago || '';
  if (metodo.includes('BBVA')) return 'BBVA';
  if (metodo.includes('Azteca')) return 'Azteca';
  if (metodo.includes('Mercado Pago')) return 'Mercado Pago';
  return null;
};

// Función auxiliar para obtener configuración de cortes
const getConfiguracionCortes = async () => {
  let configCortes = await prisma.configuracionCortes.findFirst({
    where: { activo: true },
  });
  
  if (!configCortes) {
    configCortes = await prisma.configuracionCortes.create({
      data: {
        horaCorte1: '14:00',
        horaCorte2: '18:00',
        activo: true,
      },
    });
  }
  
  return configCortes;
};

// Mostrar página principal de cortes (realizar corte)
const index = async (req, res) => {
  try {
    const configCortes = await getConfiguracionCortes();
    
    // Verificar si hay saldo inicial del día
    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();
    
    const saldoInicialHoy = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: null,
      },
    });

    res.render('cortes/index', {
      title: 'Cortes de Caja',
      configCortes,
      saldoInicialHoy,
      success: req.query.success,
      error: req.query.error,
      moment,
    });
  } catch (error) {
    console.error('Error al cargar cortes:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar cortes de caja',
      error,
    });
  }
};

// Historial de cortes
const historial = async (req, res) => {
  try {
    const { fecha } = req.query;
    
    let fechaInicio, fechaFin;
    
    if (fecha) {
      fechaInicio = moment(fecha, 'YYYY-MM-DD').tz(config.timezone).startOf('day').toDate();
      fechaFin = moment(fecha, 'YYYY-MM-DD').tz(config.timezone).endOf('day').toDate();
    } else {
      // Por defecto, últimos 30 días
      fechaInicio = moment().tz(config.timezone).subtract(30, 'days').startOf('day').toDate();
      fechaFin = moment().tz(config.timezone).endOf('day').toDate();
    }

    const cortes = await prisma.corteCaja.findMany({
      where: {
        fecha: { gte: fechaInicio, lte: fechaFin },
        hora: { not: null }, // Solo cortes, no saldos iniciales
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

    res.render('cortes/historial', {
      title: 'Historial de Cortes',
      cortes,
      fecha: fecha || moment().format('YYYY-MM-DD'),
      success: req.query.success,
      error: req.query.error,
      formatCurrency,
      moment,
    });
  } catch (error) {
    console.error('Error al cargar historial de cortes:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar historial de cortes',
      error,
    });
  }
};

// Ver detalle de corte
const show = async (req, res) => {
  try {
    const { id } = req.params;

    const corte = await prisma.corteCaja.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
    });

    if (!corte) {
      return res.status(404).render('error', {
        title: 'Corte no encontrado',
        message: 'El corte de caja solicitado no existe',
      });
    }

    res.render('cortes/ver', {
      title: 'Detalle de Corte',
      corte,
      formatCurrency,
      moment,
    });
  } catch (error) {
    console.error('Error al cargar corte:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar detalle de corte',
      error,
    });
  }
};

// Guardar corte
const store = async (req, res) => {
  try {
    const {
      hora,
      saldoInicialEfectivo,
      saldoInicialTarjeta,
      saldoInicialTransferencia,
      saldoFinalEfectivo,
      saldoFinalTarjeta,
      saldoFinalTransferencia,
      observaciones,
    } = req.body;

    // Validar formato de hora
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
      return res.status(400).json({ error: 'Formato de hora inválido' });
    }

    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();

    // Verificar si ya existe un corte a esta hora
    const corteExistente = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: hora,
      },
    });

    if (corteExistente) {
      return res.status(400).json({
        error: 'Ya se realizó un corte a las ' + hora + ' hoy',
      });
    }

    // Buscar el último corte o saldo inicial del día
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const saldoInicialDelDia = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: null,
      },
    });

    // Determinar desde cuándo contar las ventas
    let desdeFecha;
    let saldosInicialesPrevios = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
    };

    if (ultimoCorte) {
      desdeFecha = ultimoCorte.createdAt;
      // Sumar los saldos de tarjeta por banco
      const tarjetaTotal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0) +
                          parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0) +
                          parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
      saldosInicialesPrevios = {
        efectivo: parseFloat(ultimoCorte.saldoFinalEfectivo || 0),
        tarjeta: tarjetaTotal,
        transferencia: parseFloat(ultimoCorte.saldoFinalTransferencia || 0),
      };
    } else if (saldoInicialDelDia) {
      desdeFecha = saldoInicialDelDia.createdAt;
      // Sumar los saldos de tarjeta por banco
      const tarjetaTotal = parseFloat(saldoInicialDelDia.saldoInicialTarjetaAzteca || 0) +
                          parseFloat(saldoInicialDelDia.saldoInicialTarjetaBbva || 0) +
                          parseFloat(saldoInicialDelDia.saldoInicialTarjetaMp || 0);
      saldosInicialesPrevios = {
        efectivo: parseFloat(saldoInicialDelDia.saldoInicialEfectivo || 0),
        tarjeta: tarjetaTotal,
        transferencia: parseFloat(saldoInicialDelDia.saldoInicialTransferencia || 0),
      };
    } else {
      desdeFecha = hoy;
    }

    // Obtener ventas desde el último corte o saldo inicial
    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: { gte: desdeFecha },
      },
      select: {
        total: true,
        metodoPago: true,
        banco: true,
      },
    });

    // Calcular ventas por método de pago y banco usando funciones helper
    const ventasEfectivo = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const ventasTarjeta = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const ventasTarjetaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const ventasTarjetaBBVA = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const ventasTarjetaMP = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Mercado Pago')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const ventasTransferencia = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    // Calcular ventas por banco - Transferencia
    const ventasTransferenciaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferenciaBbva = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferenciaMp = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia' && getBanco(v) === 'Mercado Pago')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);

    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);

    // Calcular saldos finales
    const saldoFinalEfectivoCalc = parseFloat(saldoFinalEfectivo) || 0;
    const saldoFinalTarjetaCalc = parseFloat(saldoFinalTarjeta) || 0;
    const saldoFinalTransferenciaCalc = parseFloat(saldoFinalTransferencia) || 0;

    // Calcular diferencias
    const diferenciaEfectivo = saldoFinalEfectivoCalc - (saldosInicialesPrevios.efectivo + ventasEfectivo);
    const diferenciaTarjeta = saldoFinalTarjetaCalc - (saldosInicialesPrevios.tarjeta + ventasTarjeta);
    const diferenciaTransferencia = saldoFinalTransferenciaCalc - (saldosInicialesPrevios.transferencia + ventasTransferencia);
    const diferenciaTotal = diferenciaEfectivo + diferenciaTarjeta + diferenciaTransferencia;

    // Calcular totales de saldos iniciales y finales
    const saldoInicialEfectivoVal = parseFloat(saldoInicialEfectivo || saldosInicialesPrevios.efectivo);
    const saldoInicialTarjetaVal = parseFloat(saldoInicialTarjeta || saldosInicialesPrevios.tarjeta);
    const saldoInicialTransferenciaVal = parseFloat(saldoInicialTransferencia || saldosInicialesPrevios.transferencia);
    
    const saldoInicialTotal = saldoInicialEfectivoVal + saldoInicialTarjetaVal + saldoInicialTransferenciaVal;
    const saldoFinalTotal = saldoFinalEfectivoCalc + saldoFinalTarjetaCalc + saldoFinalTransferenciaCalc;

    // Distribuir saldo de tarjeta entre bancos (por defecto todo en Azteca si no se especifica)
    const saldoInicialTarjetaAzteca = saldoInicialTarjetaVal;
    const saldoInicialTarjetaBbva = 0;
    const saldoInicialTarjetaMp = 0;
    
    const saldoFinalTarjetaAzteca = saldoFinalTarjetaCalc;
    const saldoFinalTarjetaBbva = 0;
    const saldoFinalTarjetaMp = 0;

    // Crear corte de caja
    const corte = await prisma.corteCaja.create({
      data: {
        fecha: new Date(),
        hora: hora,
        saldoInicial: saldoInicialTotal,
        saldoInicialEfectivo: saldoInicialEfectivoVal,
        saldoInicialTarjetaAzteca: saldoInicialTarjetaAzteca,
        saldoInicialTarjetaBbva: saldoInicialTarjetaBbva,
        saldoInicialTarjetaMp: saldoInicialTarjetaMp,
        saldoInicialTransferencia: saldoInicialTransferenciaVal,
        ventasEfectivo: ventasEfectivo,
        ventasTarjeta: ventasTarjeta,
        ventasTransferencia: ventasTransferencia,
        ventasTarjetaAzteca: ventasTarjetaAzteca,
        ventasTarjetaBbva: ventasTarjetaBBVA,
        ventasTarjetaMp: ventasTarjetaMP,
        ventasTransferenciaAzteca: ventasTransferenciaAzteca,
        ventasTransferenciaBbva: ventasTransferenciaBbva,
        ventasTransferenciaMp: ventasTransferenciaMp,
        totalVentas: totalVentas,
        saldoFinal: saldoFinalTotal,
        saldoFinalEfectivo: saldoFinalEfectivoCalc,
        saldoFinalTarjetaAzteca: saldoFinalTarjetaAzteca,
        saldoFinalTarjetaBbva: saldoFinalTarjetaBbva,
        saldoFinalTarjetaMp: saldoFinalTarjetaMp,
        saldoFinalTransferencia: saldoFinalTransferenciaCalc,
        diferencia: diferenciaTotal,
        observaciones: observaciones || null,
        usuarioId: req.session.user?.id || null,
      },
    });

    res.json({ success: true, corteId: corte.id });
  } catch (error) {
    console.error('Error al guardar corte:', error);
    res.status(500).json({ error: 'Error al guardar corte de caja' });
  }
};

// Generar reporte PDF
const reporte = async (req, res) => {
  try {
    const { id } = req.params;

    const corte = await prisma.corteCaja.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
    });

    if (!corte) {
      return res.status(404).render('error', {
        title: 'Corte no encontrado',
        message: 'El corte de caja solicitado no existe',
      });
    }

    // Determinar el período del corte para obtener las ventas
    const fechaCorte = moment(corte.fecha).tz(config.timezone).startOf('day').toDate();
    const fechaFinCorte = moment(corte.fecha).tz(config.timezone).endOf('day').toDate();
    
    // Buscar el último corte anterior o saldo inicial del día
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: fechaCorte, lte: fechaFinCorte },
        hora: { not: null },
        createdAt: { lt: corte.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    const saldoInicialDelDia = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: fechaCorte, lte: fechaFinCorte },
        hora: null,
        createdAt: { lt: corte.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Determinar desde cuándo contar las ventas
    let desdeFecha;
    if (ultimoCorte) {
      desdeFecha = ultimoCorte.createdAt;
    } else if (saldoInicialDelDia) {
      desdeFecha = saldoInicialDelDia.createdAt;
    } else {
      desdeFecha = fechaCorte;
    }
    
    // Obtener ventas del período
    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: { gte: desdeFecha, lte: corte.createdAt },
      },
      include: {
        doctor: true,
      },
    });
    
    // Agrupar ventas por doctor
    const ventasPorDoctor = {};
    ventas.forEach(v => {
      const doctorId = v.doctorId || 0;
      const doctorNombre = v.doctor ? `${v.doctor.nombre} ${v.doctor.apellido}` : 'Sin Doctor';
      
      if (!ventasPorDoctor[doctorId]) {
        ventasPorDoctor[doctorId] = {
          doctorId,
          doctorNombre,
          efectivo: 0,
          tarjeta: {
            total: 0,
            Azteca: 0,
            BBVA: 0,
            'Mercado Pago': 0,
          },
          transferencia: {
            total: 0,
            Azteca: 0,
            BBVA: 0,
            'Mercado Pago': 0,
          },
        };
      }
      
      const total = parseFloat(v.total);
      const metodoBase = getMetodoBase(v.metodoPago);
      const bancoVenta = getBanco(v);
      
      if (metodoBase === 'efectivo') {
        ventasPorDoctor[doctorId].efectivo += total;
      } else if (metodoBase === 'tarjeta') {
        ventasPorDoctor[doctorId].tarjeta.total += total;
        if (bancoVenta && ventasPorDoctor[doctorId].tarjeta[bancoVenta] !== undefined) {
          ventasPorDoctor[doctorId].tarjeta[bancoVenta] += total;
        }
      } else if (metodoBase === 'transferencia') {
        ventasPorDoctor[doctorId].transferencia.total += total;
        if (bancoVenta && ventasPorDoctor[doctorId].transferencia[bancoVenta] !== undefined) {
          ventasPorDoctor[doctorId].transferencia[bancoVenta] += total;
        }
      }
    });
    
    // Convertir a array y ordenar por nombre de doctor
    const ventasPorDoctorArray = Object.values(ventasPorDoctor).sort((a, b) => 
      a.doctorNombre.localeCompare(b.doctorNombre)
    );

    // Configurar headers ANTES de crear el documento PDF
    const fechaFormato = moment(corte.fecha).format('YYYY-MM-DD');
    const horaFormato = corte.hora ? corte.hora.replace(':', '-') : 'saldo-inicial';
    const nombreArchivo = `corte_${corte.id}_${fechaFormato}_${horaFormato}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    // Crear documento PDF después de configurar headers
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).text(config.clinica.nombre, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Reporte de Corte de Caja', { align: 'center' });
    doc.moveDown();

    // Información del corte
    doc.fontSize(12);
    doc.text(`Folio: ${corte.id}`);
    doc.text(`Fecha: ${moment(corte.fecha).format('DD/MM/YYYY')}`);
    doc.text(`Hora: ${corte.hora || 'Saldo Inicial'}`);
    if (corte.usuario) {
      doc.text(`Realizado por: ${corte.usuario.nombre}`);
    }
    doc.moveDown();

    // Saldos iniciales
    doc.fontSize(14).text('Saldos Iniciales', { underline: true });
    doc.fontSize(12);
    doc.text(`Efectivo: $${parseFloat(corte.saldoInicialEfectivo).toFixed(2)}`);
    const saldoInicialTarjetaTotal = parseFloat(corte.saldoInicialTarjetaAzteca || 0) +
                                    parseFloat(corte.saldoInicialTarjetaBbva || 0) +
                                    parseFloat(corte.saldoInicialTarjetaMp || 0);
    doc.text(`Tarjeta: $${saldoInicialTarjetaTotal.toFixed(2)}`);
    doc.text(`Transferencia: $${parseFloat(corte.saldoInicialTransferencia).toFixed(2)}`);
    doc.text(`Total: $${parseFloat(corte.saldoInicial).toFixed(2)}`);
    doc.moveDown();

    // Ventas por Doctor
    if (ventasPorDoctorArray.length > 0) {
      doc.fontSize(14).text('Ventas por Doctor', { underline: true });
      doc.fontSize(12);
      
      ventasPorDoctorArray.forEach(docVenta => {
        const totalDoc = docVenta.efectivo + docVenta.tarjeta.total + docVenta.transferencia.total;
        doc.moveDown(0.5);
        doc.fontSize(13).text(docVenta.doctorNombre, { underline: false, bold: true });
        doc.fontSize(11);
        doc.text(`  Total: $${totalDoc.toFixed(2)}`, { indent: 20 });
        doc.text(`  Efectivo: $${docVenta.efectivo.toFixed(2)}`, { indent: 20 });
        
        if (docVenta.tarjeta.total > 0) {
          doc.text(`  Tarjeta: $${docVenta.tarjeta.total.toFixed(2)}`, { indent: 20 });
          if (docVenta.tarjeta.Azteca > 0) {
            doc.text(`    - Azteca: $${docVenta.tarjeta.Azteca.toFixed(2)}`, { indent: 40 });
          }
          if (docVenta.tarjeta.BBVA > 0) {
            doc.text(`    - BBVA: $${docVenta.tarjeta.BBVA.toFixed(2)}`, { indent: 40 });
          }
          if (docVenta.tarjeta['Mercado Pago'] > 0) {
            doc.text(`    - Mercado Pago: $${docVenta.tarjeta['Mercado Pago'].toFixed(2)}`, { indent: 40 });
          }
        }
        
        if (docVenta.transferencia.total > 0) {
          doc.text(`  Transferencia: $${docVenta.transferencia.total.toFixed(2)}`, { indent: 20 });
          if (docVenta.transferencia.Azteca > 0) {
            doc.text(`    - Azteca: $${docVenta.transferencia.Azteca.toFixed(2)}`, { indent: 40 });
          }
          if (docVenta.transferencia.BBVA > 0) {
            doc.text(`    - BBVA: $${docVenta.transferencia.BBVA.toFixed(2)}`, { indent: 40 });
          }
          if (docVenta.transferencia['Mercado Pago'] > 0) {
            doc.text(`    - Mercado Pago: $${docVenta.transferencia['Mercado Pago'].toFixed(2)}`, { indent: 40 });
          }
        }
      });
      doc.moveDown();
    }
    
    // Resumen de Ventas
    doc.fontSize(14).text('Resumen de Ventas del Período', { underline: true });
    doc.fontSize(12);
    doc.text(`Efectivo: $${parseFloat(corte.ventasEfectivo).toFixed(2)}`);
    doc.text(`Tarjeta: $${parseFloat(corte.ventasTarjeta).toFixed(2)}`);
    if (parseFloat(corte.ventasTarjeta) > 0) {
      doc.text(`  - Azteca: $${parseFloat(corte.ventasTarjetaAzteca).toFixed(2)}`, { indent: 20 });
      doc.text(`  - BBVA: $${parseFloat(corte.ventasTarjetaBbva || 0).toFixed(2)}`, { indent: 20 });
      doc.text(`  - Mercado Pago: $${parseFloat(corte.ventasTarjetaMp || 0).toFixed(2)}`, { indent: 20 });
    }
    doc.text(`Transferencia: $${parseFloat(corte.ventasTransferencia).toFixed(2)}`);
    if (parseFloat(corte.ventasTransferencia) > 0) {
      doc.text(`  - Azteca: $${parseFloat(corte.ventasTransferenciaAzteca || 0).toFixed(2)}`, { indent: 20 });
      doc.text(`  - BBVA: $${parseFloat(corte.ventasTransferenciaBbva || 0).toFixed(2)}`, { indent: 20 });
      doc.text(`  - Mercado Pago: $${parseFloat(corte.ventasTransferenciaMp || 0).toFixed(2)}`, { indent: 20 });
    }
    doc.text(`Total Ventas: $${parseFloat(corte.totalVentas).toFixed(2)}`);
    doc.moveDown();

    // Saldos finales
    doc.fontSize(14).text('Saldos Finales', { underline: true });
    doc.fontSize(12);
    doc.text(`Efectivo: $${parseFloat(corte.saldoFinalEfectivo).toFixed(2)}`);
    const saldoFinalTarjetaTotal = parseFloat(corte.saldoFinalTarjetaAzteca || 0) +
                                  parseFloat(corte.saldoFinalTarjetaBbva || 0) +
                                  parseFloat(corte.saldoFinalTarjetaMp || 0);
    doc.text(`Tarjeta: $${saldoFinalTarjetaTotal.toFixed(2)}`);
    doc.text(`Transferencia: $${parseFloat(corte.saldoFinalTransferencia).toFixed(2)}`);
    doc.text(`Total: $${parseFloat(corte.saldoFinal).toFixed(2)}`);
    doc.moveDown();

    // Diferencia
    doc.fontSize(14).text(`Diferencia: $${parseFloat(corte.diferencia).toFixed(2)}`, {
      underline: true,
      color: parseFloat(corte.diferencia) < 0 ? 'red' : 'black',
    });

    if (corte.observaciones) {
      doc.moveDown();
      doc.fontSize(12).text('Observaciones:', { underline: true });
      doc.text(corte.observaciones);
    }

    doc.end();
  } catch (error) {
    console.error('Error al generar reporte:', error);
    // Si los headers ya se enviaron, no podemos renderizar HTML
    if (!res.headersSent) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Error al generar reporte PDF',
        error,
      });
    } else {
      // Si los headers ya se enviaron, solo loguear el error
      console.error('Error después de enviar headers PDF:', error);
    }
  }
};

module.exports = {
  index,
  historial,
  show,
  store,
  reporte,
};

