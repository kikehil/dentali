const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const config = require('../config/config');
const { generateFolio, formatCurrency } = require('../utils/helpers');
const { notifyNewSale } = require('../utils/webhooks');

// Función auxiliar para obtener el último corte de caja del día
const getUltimoCorteHoy = async () => {
  const hoy = moment().tz(config.timezone).startOf('day').toDate();
  const mañana = moment().tz(config.timezone).endOf('day').toDate();
  
  const ultimoCorte = await prisma.corteCaja.findFirst({
    where: {
      fecha: { gte: hoy, lte: mañana },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return ultimoCorte;
};

// Función auxiliar para obtener configuración de cortes
const getConfiguracionCortes = async () => {
  let configCortes = await prisma.configuracionCortes.findFirst({
    where: { activo: true },
  });
  
  // Si no existe configuración, crear una con valores por defecto
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

// Mostrar punto de venta
const index = async (req, res) => {
  try {
    const ultimoCorte = await getUltimoCorteHoy();
    
    // Verificar si necesita saldo inicial
    // 1. Si viene del login con el parámetro
    // 2. No hay saldo inicial hoy
    // 3. Si hay cualquier corte hoy (automático o manual), necesita saldo inicial
    //    porque después de cualquier corte, al día siguiente se necesita saldo inicial
    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();
    const ayer = moment().tz(config.timezone).subtract(1, 'day').startOf('day').toDate();
    const finAyer = moment().tz(config.timezone).subtract(1, 'day').endOf('day').toDate();
    
    // Buscar el último corte del día (si existe)
    const ultimoCorteHoy = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null }, // Solo cortes, no saldos iniciales
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Buscar el saldo inicial más reciente (después del último corte si existe)
    let saldoInicialHoy;
    if (ultimoCorteHoy) {
      // Si hay un corte, buscar el saldo inicial creado DESPUÉS de ese corte
      saldoInicialHoy = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
          createdAt: { gt: ultimoCorteHoy.createdAt }, // Después del último corte
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Si no hay corte, buscar cualquier saldo inicial del día
      saldoInicialHoy = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    
    // Necesita saldo inicial si:
    // - Viene con el parámetro necesitaSaldoInicial=true (siempre mostrar, sin importar si hay saldo inicial)
    // - No hay saldo inicial después del último corte (si hay corte)
    // - No hay saldo inicial del día (si no hay corte)
    const necesitaSaldoInicial = 
      req.query.necesitaSaldoInicial === 'true' ||
      !saldoInicialHoy;
    
    // PRIORIDAD 1: Si necesita saldo inicial, mostrar modal primero (no importa si necesita corte)
    // El saldo inicial es más importante que el corte - debe ingresarse antes de cualquier corte
    // Si viene con el parámetro necesitaSaldoInicial=true, siempre mostrar el modal
    // Obtener tipo de cambio activo
    const configTipoCambio = await prisma.configuracionTipoCambio.findFirst({
      where: { activo: true },
    });
    const tipoCambio = configTipoCambio ? parseFloat(configTipoCambio.tipoCambio) : 20.0;

    if (necesitaSaldoInicial) {
      const [servicios, productos, pacientes, doctores] = await Promise.all([
        prisma.servicio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
        prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
        prisma.paciente.findMany({ where: { activo: true }, take: 100, orderBy: { nombre: 'asc' } }),
        prisma.doctor.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      ]);

      return res.render('pos/index', {
        title: 'Punto de Venta',
        servicios,
        productos,
        pacientes,
        doctores,
        formatCurrency,
        tipoCambio,
        necesitaSaldoInicial: true,
        ultimoCorte: null,
      });
    }
    
    const [servicios, productos, pacientes, doctores] = await Promise.all([
      prisma.servicio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.paciente.findMany({ where: { activo: true }, take: 100, orderBy: { nombre: 'asc' } }),
      prisma.doctor.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    ]);

    res.render('pos/index', {
      title: 'Punto de Venta',
      servicios,
      productos,
      pacientes,
      doctores,
      formatCurrency,
      tipoCambio,
      necesitaSaldoInicial: false,
    });
  } catch (error) {
    console.error('Error al cargar POS:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar punto de venta', error });
  }
};

// Procesar venta
const processSale = async (req, res) => {
  try {
    const { pacienteId, doctorId, items, descuento, metodoPago, banco, moneda, notas } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No hay items en la venta' });
    }

    // Calcular totales
    let subtotal = 0;
    const itemsData = [];

    for (const item of items) {
      const itemSubtotal = parseFloat(item.precio) * parseInt(item.cantidad);
      subtotal += itemSubtotal;

      itemsData.push({
        tipo: item.tipo,
        servicioId: item.tipo === 'servicio' ? parseInt(item.id) : null,
        productoId: item.tipo === 'producto' ? parseInt(item.id) : null,
        cantidad: parseInt(item.cantidad),
        precioUnit: parseFloat(item.precio),
        subtotal: itemSubtotal,
      });

      // Actualizar stock si es producto
      if (item.tipo === 'producto') {
        await prisma.producto.update({
          where: { id: parseInt(item.id) },
          data: { stock: { decrement: parseInt(item.cantidad) } },
        });
      }
    }

    const descuentoAmount = parseFloat(descuento) || 0;
    const total = subtotal - descuentoAmount;

    // Guardar método de pago sin modificar (solo 'efectivo', 'tarjeta' o 'transferencia')
    // El banco se guarda por separado en el campo banco
    const metodoPagoFinal = metodoPago || 'efectivo';

    // Crear venta
    const venta = await prisma.venta.create({
      data: {
        folio: generateFolio(),
        pacienteId: pacienteId ? parseInt(pacienteId) : null,
        doctorId: doctorId ? parseInt(doctorId) : null,
        subtotal,
        descuento: descuentoAmount,
        total,
        metodoPago: metodoPagoFinal,
        banco: (metodoPago === 'tarjeta' || metodoPago === 'transferencia') ? (banco || null) : null,
        moneda: moneda || 'MXN',
        notas: notas || null,
        items: { create: itemsData },
      },
      include: {
        items: {
          include: {
            servicio: true,
            producto: true,
          },
        },
        paciente: true,
      },
    });

    // Enviar webhook
    await notifyNewSale(venta, venta.items, venta.paciente);

    res.json({
      success: true,
      venta: {
        id: venta.id,
        folio: venta.folio,
        total: formatCurrency(venta.total),
      },
    });
  } catch (error) {
    console.error('Error al procesar venta:', error);
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
};

// Historial de ventas
const ventas = async (req, res) => {
  try {
    const { fecha } = req.query;
    
    // Calcular inicio y fin del día
    const hoy = fecha ? new Date(fecha) : new Date();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

    // Obtener ventas (todas o filtradas por fecha)
    const whereClause = fecha ? {
      createdAt: { gte: inicioDia, lte: finDia }
    } : {};

    const ventasList = await prisma.venta.findMany({
      where: whereClause,
      include: {
        paciente: true,
        items: {
          include: {
            servicio: true,
            producto: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Obtener resumen del día de HOY
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const ventasHoy = await prisma.venta.findMany({
      where: {
        createdAt: { gte: hoyInicio, lte: hoyFin }
      },
      select: {
        total: true,
        metodoPago: true,
        banco: true,
      },
    });

    // Calcular estadísticas
    const totalHoy = ventasHoy.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const cantidadHoy = ventasHoy.length;
    const promedio = cantidadHoy > 0 ? totalHoy / cantidadHoy : 0;
    
    // Método más popular
    const metodos = {};
    ventasHoy.forEach(v => {
      metodos[v.metodoPago] = (metodos[v.metodoPago] || 0) + 1;
    });
    const metodoPopular = Object.keys(metodos).length > 0 
      ? Object.keys(metodos).reduce((a, b) => metodos[a] > metodos[b] ? a : b)
      : 'N/A';

    // Calcular estado de caja de la sesión actual
    const hoyCaja = moment().tz(config.timezone).startOf('day').toDate();
    const mañanaCaja = moment().tz(config.timezone).endOf('day').toDate();
    
    const saldoInicialDelDia = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoyCaja, lte: mañanaCaja },
        hora: null,
      },
    });
    
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoyCaja, lte: mañanaCaja },
        hora: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    let saldoInicial = 0;
    let ventasDesdeUltimoCorte = [];
    
    if (ultimoCorte) {
      saldoInicial = parseFloat(ultimoCorte.saldoFinal);
      const desdeUltimoCorte = ultimoCorte.createdAt;
      
      ventasDesdeUltimoCorte = await prisma.venta.findMany({
        where: {
          createdAt: { gte: desdeUltimoCorte },
        },
        select: {
          total: true,
          metodoPago: true,
        },
      });
    } else if (saldoInicialDelDia) {
      saldoInicial = parseFloat(saldoInicialDelDia.saldoInicial);
      const desdeSaldoInicial = saldoInicialDelDia.createdAt;
      
      ventasDesdeUltimoCorte = await prisma.venta.findMany({
        where: {
          createdAt: { gte: desdeSaldoInicial },
        },
        select: {
          total: true,
          metodoPago: true,
        },
      });
    } else {
      const hoyInicio = moment().tz(config.timezone).startOf('day').toDate();
      ventasDesdeUltimoCorte = await prisma.venta.findMany({
        where: {
          createdAt: { gte: hoyInicio },
        },
        select: {
          total: true,
          metodoPago: true,
        },
      });
    }
    
    const totalVentasSesion = ventasDesdeUltimoCorte.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasEfectivoSesion = ventasDesdeUltimoCorte
      .filter(v => v.metodoPago === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaSesion = ventasDesdeUltimoCorte
      .filter(v => v.metodoPago === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferenciaSesion = ventasDesdeUltimoCorte
      .filter(v => v.metodoPago === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    const saldoEsperado = saldoInicial + ventasEfectivoSesion;

    res.render('pos/ventas', {
      title: 'Historial de Ventas',
      ventas: ventasList,
      formatCurrency,
      resumen: {
        ventasHoy: cantidadHoy,
        totalHoy: formatCurrency(totalHoy),
        promedio: formatCurrency(promedio),
        metodoPopular: metodoPopular,
      },
      estadoCaja: {
        saldoInicial,
        totalVentas: totalVentasSesion,
        ventasEfectivo: ventasEfectivoSesion,
        ventasTarjeta: ventasTarjetaSesion,
        ventasTransferencia: ventasTransferenciaSesion,
        saldoEsperado,
        cantidadVentas: ventasDesdeUltimoCorte.length,
      },
    });
  } catch (error) {
    console.error('Error al cargar ventas:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar ventas', error });
  }
};

// Gestión de servicios
const servicios = async (req, res) => {
  try {
    const serviciosList = await prisma.servicio.findMany({
      orderBy: { nombre: 'asc' },
    });

    res.render('pos/servicios', {
      title: 'Gestión de Servicios',
      servicios: serviciosList,
      formatCurrency,
    });
  } catch (error) {
    console.error('Error al cargar servicios:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar servicios', error });
  }
};

// Crear/Actualizar servicio
const saveServicio = async (req, res) => {
  try {
    const { id, nombre, descripcion, precio, duracion, categoria, activo } = req.body;

    if (id) {
      await prisma.servicio.update({
        where: { id: parseInt(id) },
        data: {
          nombre,
          descripcion,
          precio: parseFloat(precio),
          duracion: parseInt(duracion),
          categoria,
          activo: activo === 'true',
        },
      });
    } else {
      await prisma.servicio.create({
        data: {
          nombre,
          descripcion,
          precio: parseFloat(precio),
          duracion: parseInt(duracion) || 30,
          categoria,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al guardar servicio:', error);
    res.status(500).json({ error: 'Error al guardar servicio' });
  }
};

// Gestión de productos
const productos = async (req, res) => {
  try {
    const productosList = await prisma.producto.findMany({
      orderBy: { nombre: 'asc' },
    });

    // Alertas de stock bajo
    const stockBajo = productosList.filter(p => p.stock <= p.stockMinimo && p.activo);

    res.render('pos/productos', {
      title: 'Gestión de Productos',
      productos: productosList,
      stockBajo,
      formatCurrency,
    });
  } catch (error) {
    console.error('Error al cargar productos:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar productos', error });
  }
};

// Crear/Actualizar producto
const saveProducto = async (req, res) => {
  try {
    const { id, nombre, descripcion, precio, costo, stock, stockMinimo, categoria, activo } = req.body;

    if (id) {
      await prisma.producto.update({
        where: { id: parseInt(id) },
        data: {
          nombre,
          descripcion,
          precio: parseFloat(precio),
          costo: costo ? parseFloat(costo) : null,
          stock: parseInt(stock),
          stockMinimo: parseInt(stockMinimo),
          categoria,
          activo: activo === 'true',
        },
      });
    } else {
      await prisma.producto.create({
        data: {
          nombre,
          descripcion,
          precio: parseFloat(precio),
          costo: costo ? parseFloat(costo) : null,
          stock: parseInt(stock) || 0,
          stockMinimo: parseInt(stockMinimo) || 5,
          categoria,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al guardar producto:', error);
    res.status(500).json({ error: 'Error al guardar producto' });
  }
};

// Ver detalle de venta
const getVenta = async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        paciente: true,
        items: {
          include: {
            servicio: true,
            producto: true,
          },
        },
      },
    });

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

// Guardar saldo inicial
const guardarSaldoInicial = async (req, res) => {
  try {
    const { 
      saldoInicial, 
      saldoInicialEfectivo, 
      saldoInicialTarjeta, 
      saldoInicialTransferencia 
    } = req.body;
    
    // Si vienen saldos individuales, usarlos; si no, usar el saldo inicial único
    let efectivo = 0;
    let tarjeta = 0;
    let transferencia = 0;
    
    if (saldoInicialEfectivo !== undefined || saldoInicialTarjeta !== undefined || saldoInicialTransferencia !== undefined) {
      efectivo = parseFloat(saldoInicialEfectivo || 0);
      tarjeta = parseFloat(saldoInicialTarjeta || 0);
      transferencia = parseFloat(saldoInicialTransferencia || 0);
    } else {
      // Compatibilidad con frontend antiguo
      const saldo = parseFloat(saldoInicial || 0);
      if (isNaN(saldo) || saldo < 0) {
        return res.status(400).json({ error: 'Saldo inicial inválido. Debe ser un número mayor o igual a 0' });
      }
      efectivo = saldo; // Por defecto, todo va a efectivo
    }

    // Validar que todos los saldos sean números válidos
    if (isNaN(efectivo) || efectivo < 0 || isNaN(tarjeta) || tarjeta < 0 || isNaN(transferencia) || transferencia < 0) {
      return res.status(400).json({ error: 'Los saldos iniciales deben ser números mayores o iguales a 0' });
    }

    // Permitir crear múltiples saldos iniciales en el mismo día
    // Esto es necesario porque después de cada corte se debe crear un nuevo saldo inicial
    // No validamos si ya existe uno, simplemente creamos uno nuevo
    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();

    const saldoInicialTotal = efectivo + tarjeta + transferencia;

    // Crear registro de saldo inicial (sin hora específica)
    // Distribuir tarjeta entre los bancos (por defecto todo en Azteca, se puede ajustar después)
    await prisma.corteCaja.create({
      data: {
        fecha: new Date(),
        hora: null,
        saldoInicial: saldoInicialTotal,
        saldoInicialEfectivo: efectivo,
        saldoInicialTarjetaAzteca: tarjeta, // Por defecto, todo el saldo de tarjeta va a Azteca
        saldoInicialTarjetaBbva: 0,
        saldoInicialTarjetaMp: 0,
        saldoInicialTransferencia: transferencia,
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        ventasTransferencia: 0,
        ventasTarjetaAzteca: 0,
        ventasTarjetaBbva: 0,
        ventasTarjetaMp: 0,
        ventasTransferenciaAzteca: 0,
        ventasTransferenciaBbva: 0,
        ventasTransferenciaMp: 0,
        totalVentas: 0,
        saldoFinal: saldoInicialTotal,
        saldoFinalEfectivo: efectivo,
        saldoFinalTarjetaAzteca: tarjeta,
        saldoFinalTarjetaBbva: 0,
        saldoFinalTarjetaMp: 0,
        saldoFinalTransferencia: transferencia,
        diferencia: 0,
        observaciones: null,
        usuarioId: req.session.user?.id || null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error al guardar saldo inicial:', error);
    // Mostrar mensaje de error más específico
    let mensajeError = 'Error al guardar saldo inicial';
    
    // Mensajes de error más específicos según el tipo de error
    if (error.code === 'P2002') {
      mensajeError = 'Ya existe un registro con estos datos';
    } else if (error.code === 'P2003') {
      mensajeError = 'Error de referencia en la base de datos';
    } else if (error.message) {
      mensajeError = error.message;
    }
    
    res.status(500).json({ error: mensajeError });
  }
};

// Funciones helper para manejar método de pago y banco
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

// Mostrar vista de corte de caja
const mostrarCorte = async (req, res) => {
  try {
    const { hora } = req.query;
    
    // Si no viene hora, redirigir al POS
    if (!hora) {
      return res.redirect('/pos');
    }
    
    // Validar formato de hora (HH:MM) - permitir cualquier hora, no solo las configuradas
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
      return res.redirect('/pos');
    }
    
    // Verificar que haya saldo inicial antes de permitir hacer un corte
    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();
    const saldoInicialHoy = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: null,
      },
    });
    
    // Si no hay saldo inicial, redirigir al POS para que lo ingrese primero
    if (!saldoInicialHoy) {
      return res.redirect('/pos?necesitaSaldoInicial=true');
    }
    
    // Obtener configuración de cortes para verificar si es el segundo corte (fin día)
    const configCortes = await getConfiguracionCortes();
    const esFinDia = hora === configCortes.horaCorte2;
    
    // Buscar el saldo inicial del día o el último corte
    const saldoInicialDelDia = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: null,
      },
    });
    
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Determinar desde cuándo contar las ventas
    let desdeFecha;
    let saldoInicial;
    
    if (ultimoCorte) {
      desdeFecha = ultimoCorte.createdAt;
      saldoInicial = parseFloat(ultimoCorte.saldoFinal);
    } else if (saldoInicialDelDia) {
      desdeFecha = saldoInicialDelDia.createdAt;
      saldoInicial = parseFloat(saldoInicialDelDia.saldoInicial);
    } else {
      // No hay saldo inicial ni cortes, usar inicio del día
      desdeFecha = hoy;
      saldoInicial = 0;
    }

    // Obtener ventas desde el último corte o saldo inicial
    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: { gte: desdeFecha },
      },
      include: {
        paciente: true,
        doctor: true,
        items: {
          include: {
            servicio: true,
            producto: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    // Obtener gastos del período
    const gastos = await prisma.gasto.findMany({
      where: {
        createdAt: { gte: desdeFecha },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
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

    // Calcular totales
    const ventasEfectivo = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjeta = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferencia = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    // Calcular ventas por banco - Tarjeta
    const ventasTarjetaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaBbva = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaMp = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Mercado Pago')
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
    const saldoEsperado = saldoInicial + ventasEfectivo;

    res.render('pos/corte', {
      title: `Corte de Caja - ${hora}`,
      hora,
      esManual: false, // Es un corte automático programado
      esFinDia: esFinDia, // Si es el corte de las 6pm (fin día)
      ultimoCorte: ultimoCorte || saldoInicialDelDia,
      ventas,
      gastos,
      ventasPorDoctor: ventasPorDoctorArray,
      desdeFecha,
      formatCurrency,
      resumen: {
        saldoInicial,
        ventasEfectivo,
        ventasTarjeta,
        ventasTransferencia,
        ventasTarjetaAzteca,
        ventasTarjetaBbva,
        ventasTarjetaMp,
        ventasTransferenciaAzteca,
        ventasTransferenciaBbva,
        ventasTransferenciaMp,
        totalVentas,
        saldoEsperado,
        cantidadVentas: ventas.length,
      },
    });
  } catch (error) {
    console.error('Error al mostrar corte:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar corte de caja', error });
  }
};

// Procesar corte de caja
const procesarCorte = async (req, res) => {
  try {
    const { hora, saldoFinal, observaciones } = req.body;
    
    // Validar formato de hora (HH:MM)
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM (ejemplo: 14:00)' });
    }
    
    // Obtener configuración de cortes para verificar si es el segundo corte (fin día)
    const configCortes = await getConfiguracionCortes();
    const esFinDia = hora === configCortes.horaCorte2;

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
        error: 'Ya se realizó un corte a las ' + hora + ' hoy. Si necesitas hacer otro corte, usa "Corte Manual" con una hora diferente.' 
      });
    }

    // Buscar el saldo inicial del día o el último corte
    const saldoInicialDelDia = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: null,
      },
    });
    
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Determinar desde cuándo contar las ventas y el saldo inicial
    let desdeFecha;
    let saldoInicial;
    let saldoInicialEfectivo = 0;
    let saldoInicialTarjetaAzteca = 0;
    let saldoInicialTarjetaBbva = 0;
    let saldoInicialTarjetaMp = 0;
    let saldoInicialTransferencia = 0;
    
    if (ultimoCorte) {
      desdeFecha = ultimoCorte.createdAt;
      saldoInicial = parseFloat(ultimoCorte.saldoFinal);
      saldoInicialEfectivo = parseFloat(ultimoCorte.saldoFinalEfectivo || 0);
      saldoInicialTarjetaAzteca = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0);
      saldoInicialTarjetaBbva = parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0);
      saldoInicialTarjetaMp = parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
      saldoInicialTransferencia = parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
    } else if (saldoInicialDelDia) {
      desdeFecha = saldoInicialDelDia.createdAt;
      saldoInicial = parseFloat(saldoInicialDelDia.saldoInicial);
      saldoInicialEfectivo = parseFloat(saldoInicialDelDia.saldoInicialEfectivo || 0);
      saldoInicialTarjetaAzteca = parseFloat(saldoInicialDelDia.saldoInicialTarjetaAzteca || 0);
      saldoInicialTarjetaBbva = parseFloat(saldoInicialDelDia.saldoInicialTarjetaBbva || 0);
      saldoInicialTarjetaMp = parseFloat(saldoInicialDelDia.saldoInicialTarjetaMp || 0);
      saldoInicialTransferencia = parseFloat(saldoInicialDelDia.saldoInicialTransferencia || 0);
    } else {
      // No hay saldo inicial ni cortes, usar inicio del día con saldo inicial 0
      desdeFecha = hoy;
      saldoInicial = 0;
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

    // Calcular totales (saldoInicial ya fue asignado arriba)
    const ventasEfectivo = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjeta = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferencia = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    const saldoFinalCalculado = parseFloat(saldoFinal);
    const diferencia = saldoFinalCalculado - (saldoInicial + ventasEfectivo);

    // Calcular ventas por banco - Tarjeta
    const ventasTarjetaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaBbva = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaMp = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Mercado Pago')
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

    // Crear corte de caja
    await prisma.corteCaja.create({
      data: {
        fecha: new Date(),
        hora: hora,
        saldoInicial: saldoInicial,
        saldoInicialEfectivo: saldoInicialEfectivo,
        saldoInicialTarjetaAzteca: saldoInicialTarjetaAzteca,
        saldoInicialTarjetaBbva: saldoInicialTarjetaBbva,
        saldoInicialTarjetaMp: saldoInicialTarjetaMp,
        saldoInicialTransferencia: saldoInicialTransferencia,
        ventasEfectivo: ventasEfectivo,
        ventasTarjeta: ventasTarjeta,
        ventasTransferencia: ventasTransferencia,
        ventasTarjetaAzteca: ventasTarjetaAzteca,
        ventasTarjetaBbva: ventasTarjetaBbva,
        ventasTarjetaMp: ventasTarjetaMp,
        ventasTransferenciaAzteca: ventasTransferenciaAzteca,
        ventasTransferenciaBbva: ventasTransferenciaBbva,
        ventasTransferenciaMp: ventasTransferenciaMp,
        totalVentas: totalVentas,
        saldoFinal: saldoFinalCalculado,
        saldoFinalEfectivo: saldoFinalCalculado,
        saldoFinalTarjetaAzteca: saldoInicialTarjetaAzteca + ventasTarjetaAzteca,
        saldoFinalTarjetaBbva: saldoInicialTarjetaBbva + ventasTarjetaBbva,
        saldoFinalTarjetaMp: saldoInicialTarjetaMp + ventasTarjetaMp,
        saldoFinalTransferencia: saldoInicialTransferencia + ventasTransferencia,
        diferencia: diferencia,
        observaciones: observaciones || null,
        usuarioId: req.session.user?.id || null,
      },
    });

    // Después de CUALQUIER corte, se debe solicitar saldo inicial inmediatamente
    // Si es fin de día (corte de las 6pm), también mostrar opción de fin día
    
    res.json({ 
      success: true, 
      requiereSaldoInicial: true,
      esFinDia: esFinDia 
    });
  } catch (error) {
    console.error('Error al procesar corte:', error);
    res.status(500).json({ error: 'Error al procesar corte de caja' });
  }
};

// Verificar contraseña de administrador
const verificarPasswordAdmin = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Contraseña requerida' });
    }

    // Buscar usuario administrador
    const admin = await prisma.usuario.findFirst({
      where: {
        rol: 'admin',
        activo: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: 'No se encontró un administrador activo' });
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, admin.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al verificar contraseña:', error);
    res.status(500).json({ error: 'Error al verificar contraseña' });
  }
};

// Mostrar vista de corte manual
const mostrarCorteManual = async (req, res) => {
  try {
    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();
    
    // Buscar el último corte del día (si existe)
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null }, // Solo cortes, no saldos iniciales
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Buscar el saldo inicial más reciente (después del último corte si existe)
    let saldoInicialDelDia;
    if (ultimoCorte) {
      // Si hay un corte, buscar el saldo inicial creado DESPUÉS de ese corte
      saldoInicialDelDia = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
          createdAt: { gt: ultimoCorte.createdAt }, // Después del último corte
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Si no hay corte, buscar cualquier saldo inicial del día
      saldoInicialDelDia = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    
    // Si no hay saldo inicial después del último corte, pero hay un último corte,
    // usar el saldo final del último corte como referencia temporal
    // Esto permite hacer el corte, y después se pedirá el nuevo saldo inicial
    let desdeFecha;
    let saldoInicial;
    let saldoInicialEfectivo, saldoInicialTarjetaAzteca, saldoInicialTarjetaBbva, saldoInicialTarjetaMp, saldoInicialTransferencia;
    
    if (!saldoInicialDelDia && ultimoCorte) {
      // No hay saldo inicial después del último corte, usar el saldo final del último corte como referencia
      desdeFecha = ultimoCorte.createdAt;
      saldoInicialEfectivo = parseFloat(ultimoCorte.saldoFinalEfectivo || 0);
      saldoInicialTarjetaAzteca = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0);
      saldoInicialTarjetaBbva = parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0);
      saldoInicialTarjetaMp = parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
      saldoInicialTransferencia = parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
      saldoInicial = saldoInicialEfectivo + saldoInicialTarjetaAzteca + saldoInicialTarjetaBbva + saldoInicialTarjetaMp + saldoInicialTransferencia;
    } else if (saldoInicialDelDia) {
      // Hay saldo inicial, usarlo
      desdeFecha = saldoInicialDelDia.createdAt;
      saldoInicialEfectivo = parseFloat(saldoInicialDelDia.saldoInicialEfectivo || 0);
      saldoInicialTarjetaAzteca = parseFloat(saldoInicialDelDia.saldoInicialTarjetaAzteca || 0);
      saldoInicialTarjetaBbva = parseFloat(saldoInicialDelDia.saldoInicialTarjetaBbva || 0);
      saldoInicialTarjetaMp = parseFloat(saldoInicialDelDia.saldoInicialTarjetaMp || 0);
      saldoInicialTransferencia = parseFloat(saldoInicialDelDia.saldoInicialTransferencia || 0);
      saldoInicial = saldoInicialEfectivo + saldoInicialTarjetaAzteca + saldoInicialTarjetaBbva + saldoInicialTarjetaMp + saldoInicialTransferencia;
      
      // Si hay un corte después del saldo inicial, contar ventas desde ese corte
      if (ultimoCorte && ultimoCorte.createdAt > saldoInicialDelDia.createdAt) {
        desdeFecha = ultimoCorte.createdAt;
      }
    } else {
      // No hay saldo inicial ni corte, redirigir a pedir saldo inicial
      return res.redirect('/pos?necesitaSaldoInicial=true');
    }

    // Obtener ventas desde el último corte o saldo inicial
    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: { gte: desdeFecha },
      },
      include: {
        paciente: true,
        doctor: true,
        items: {
          include: {
            servicio: true,
            producto: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    // Obtener gastos del período
    const gastos = await prisma.gasto.findMany({
      where: {
        createdAt: { gte: desdeFecha },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
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

    // Calcular totales
    const ventasEfectivo = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjeta = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferencia = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    // Calcular ventas por banco - Tarjeta
    const ventasTarjetaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaBbva = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaMp = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Mercado Pago')
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
    const saldoEsperado = saldoInicial + ventasEfectivo;

    // Obtener hora actual para el corte manual
    const horaActual = moment().tz(config.timezone).format('HH:mm');

    res.render('pos/corte', {
      title: 'Corte Manual de Caja',
      hora: horaActual,
      esManual: true,
      esFinDia: false,
      ultimoCorte: saldoInicialDelDia || ultimoCorte,
      ventas,
      gastos,
      ventasPorDoctor: ventasPorDoctorArray,
      desdeFecha,
      formatCurrency,
      resumen: {
        saldoInicial,
        ventasEfectivo,
        ventasTarjeta,
        ventasTransferencia,
        ventasTarjetaAzteca,
        ventasTarjetaBbva,
        ventasTarjetaMp,
        ventasTransferenciaAzteca,
        ventasTransferenciaBbva,
        ventasTransferenciaMp,
        totalVentas,
        saldoEsperado,
        cantidadVentas: ventas.length,
      },
    });
  } catch (error) {
    console.error('Error al mostrar corte manual:', error);
    res.render('error', { title: 'Error', message: 'Error al cargar corte de caja', error });
  }
};

// Procesar corte manual
const procesarCorteManual = async (req, res) => {
  try {
    const { hora, saldoFinal, observaciones } = req.body;
    
    if (!hora) {
      return res.status(400).json({ error: 'Hora requerida' });
    }

    if (!saldoFinal || isNaN(parseFloat(saldoFinal))) {
      return res.status(400).json({ error: 'Saldo final requerido y debe ser un número válido' });
    }

    // Validar formato de hora (HH:MM)
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM (ejemplo: 14:00)' });
    }

    const hoy = moment().tz(config.timezone).startOf('day').toDate();
    const mañana = moment().tz(config.timezone).endOf('day').toDate();
    
    // Verificar si ya existe un corte a esta hora exacta HOY
    const corteExistente = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: hora, // Misma hora exacta
      },
    });

    if (corteExistente) {
      return res.status(400).json({ 
        error: 'Ya se realizó un corte a las ' + hora + ' hoy. Si necesitas hacer otro corte, usa una hora diferente.' 
      });
    }
    
    // Buscar el último corte del día (si existe)
    const ultimoCorte = await prisma.corteCaja.findFirst({
      where: {
        fecha: { gte: hoy, lte: mañana },
        hora: { not: null }, // Solo cortes, no saldos iniciales
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Buscar el saldo inicial más reciente (después del último corte si existe)
    let saldoInicialDelDia;
    if (ultimoCorte) {
      // Si hay un corte, buscar el saldo inicial creado DESPUÉS de ese corte
      saldoInicialDelDia = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
          createdAt: { gt: ultimoCorte.createdAt }, // Después del último corte
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Si no hay corte, buscar cualquier saldo inicial del día
      saldoInicialDelDia = await prisma.corteCaja.findFirst({
        where: {
          fecha: { gte: hoy, lte: mañana },
          hora: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    
    // Si no hay saldo inicial después del último corte, pero hay un último corte,
    // usar el saldo final del último corte como referencia temporal
    let desdeFecha;
    let saldoInicial;
    let saldoInicialEfectivoVal, saldoInicialTarjetaAztecaVal, saldoInicialTarjetaBbvaVal, saldoInicialTarjetaMpVal, saldoInicialTransferenciaVal;
    
    if (!saldoInicialDelDia && ultimoCorte) {
      // No hay saldo inicial después del último corte, usar el saldo final del último corte como referencia
      desdeFecha = ultimoCorte.createdAt;
      saldoInicialEfectivoVal = parseFloat(ultimoCorte.saldoFinalEfectivo || 0);
      saldoInicialTarjetaAztecaVal = parseFloat(ultimoCorte.saldoFinalTarjetaAzteca || 0);
      saldoInicialTarjetaBbvaVal = parseFloat(ultimoCorte.saldoFinalTarjetaBbva || 0);
      saldoInicialTarjetaMpVal = parseFloat(ultimoCorte.saldoFinalTarjetaMp || 0);
      saldoInicialTransferenciaVal = parseFloat(ultimoCorte.saldoFinalTransferencia || 0);
      saldoInicial = saldoInicialEfectivoVal + saldoInicialTarjetaAztecaVal + saldoInicialTarjetaBbvaVal + saldoInicialTarjetaMpVal + saldoInicialTransferenciaVal;
    } else if (saldoInicialDelDia) {
      // Hay saldo inicial, usarlo
      desdeFecha = saldoInicialDelDia.createdAt;
      saldoInicialEfectivoVal = parseFloat(saldoInicialDelDia.saldoInicialEfectivo || 0);
      saldoInicialTarjetaAztecaVal = parseFloat(saldoInicialDelDia.saldoInicialTarjetaAzteca || 0);
      saldoInicialTarjetaBbvaVal = parseFloat(saldoInicialDelDia.saldoInicialTarjetaBbva || 0);
      saldoInicialTarjetaMpVal = parseFloat(saldoInicialDelDia.saldoInicialTarjetaMp || 0);
      saldoInicialTransferenciaVal = parseFloat(saldoInicialDelDia.saldoInicialTransferencia || 0);
      saldoInicial = saldoInicialEfectivoVal + saldoInicialTarjetaAztecaVal + saldoInicialTarjetaBbvaVal + saldoInicialTarjetaMpVal + saldoInicialTransferenciaVal;
      
      // Si hay un corte después del saldo inicial, contar ventas desde ese corte
      if (ultimoCorte && ultimoCorte.createdAt > saldoInicialDelDia.createdAt) {
        desdeFecha = ultimoCorte.createdAt;
      }
    } else {
      // No hay saldo inicial ni corte, no se puede hacer el corte
      return res.status(400).json({ error: 'No se encontró el saldo inicial del día. Debes ingresar el saldo inicial primero (puede ser $0.00).' });
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

    // Calcular totales
    const ventasEfectivo = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'efectivo')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjeta = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTransferencia = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'transferencia')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    // Calcular ventas por banco (solo para tarjeta)
    const ventasTarjetaAzteca = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Azteca')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaBbva = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'BBVA')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ventasTarjetaMp = ventas
      .filter(v => getMetodoBase(v.metodoPago) === 'tarjeta' && getBanco(v) === 'Mercado Pago')
      .reduce((sum, v) => sum + parseFloat(v.total), 0);
    
    const saldoFinalCalculado = parseFloat(saldoFinal);
    const diferencia = saldoFinalCalculado - (saldoInicial + ventasEfectivo);

    // Los saldos iniciales ya están calculados arriba en las variables saldoInicialEfectivoVal, etc.

    // Crear corte de caja manual (hora personalizada)
    await prisma.corteCaja.create({
      data: {
        fecha: new Date(),
        hora: hora, // Hora manual
        saldoInicial: saldoInicial,
        saldoInicialEfectivo: saldoInicialEfectivoVal,
        saldoInicialTarjetaAzteca: saldoInicialTarjetaAztecaVal,
        saldoInicialTarjetaBbva: saldoInicialTarjetaBbvaVal,
        saldoInicialTarjetaMp: saldoInicialTarjetaMpVal,
        saldoInicialTransferencia: saldoInicialTransferenciaVal,
        ventasEfectivo: ventasEfectivo,
        ventasTarjeta: ventasTarjeta,
        ventasTransferencia: ventasTransferencia,
        ventasTarjetaAzteca: ventasTarjetaAzteca,
        ventasTarjetaBbva: ventasTarjetaBbva,
        ventasTarjetaMp: ventasTarjetaMp,
        ventasTransferenciaAzteca: 0,
        ventasTransferenciaBbva: 0,
        ventasTransferenciaMp: 0,
        totalVentas: totalVentas,
        saldoFinal: saldoFinalCalculado,
        saldoFinalEfectivo: saldoFinalCalculado,
        saldoFinalTarjetaAzteca: saldoInicialTarjetaAztecaVal + ventasTarjetaAzteca,
        saldoFinalTarjetaBbva: saldoInicialTarjetaBbvaVal + ventasTarjetaBbva,
        saldoFinalTarjetaMp: saldoInicialTarjetaMpVal + ventasTarjetaMp,
        saldoFinalTransferencia: saldoInicialTransferenciaVal + ventasTransferencia,
        diferencia: diferencia,
        observaciones: observaciones || null,
        usuarioId: req.session.user?.id || null,
      },
    });

    // Después de CUALQUIER corte, se debe solicitar saldo inicial inmediatamente
    res.json({ 
      success: true, 
      requiereSaldoInicial: true,
      esFinDia: false // Los cortes manuales no son fin de día
    });
  } catch (error) {
    console.error('Error al procesar corte manual:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Error al procesar corte de caja: ' + error.message });
  }
};

module.exports = {
  index,
  processSale,
  ventas,
  servicios,
  saveServicio,
  productos,
  saveProducto,
  getVenta,
  guardarSaldoInicial,
  mostrarCorte,
  procesarCorte,
  verificarPasswordAdmin,
  mostrarCorteManual,
  procesarCorteManual,
};

