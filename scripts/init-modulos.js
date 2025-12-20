const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initModulos() {
  try {
    console.log('Inicializando módulos del sistema...');

    const modulos = [
      {
        nombre: 'Punto de Venta',
        descripcion: 'Módulo para realizar ventas y cobros',
        ruta: '/pos',
        icono: 'fas fa-cash-register',
        activo: true,
      },
      {
        nombre: 'Pacientes',
        descripcion: 'Gestión de pacientes',
        ruta: '/pacientes',
        icono: 'fas fa-user-injured',
        activo: true,
      },
      {
        nombre: 'Doctores',
        descripcion: 'Gestión de doctores',
        ruta: '/doctores',
        icono: 'fas fa-user-md',
        activo: true,
      },
      {
        nombre: 'Historial Ventas',
        descripcion: 'Ver historial de ventas realizadas',
        ruta: '/pos/ventas',
        icono: 'fas fa-history',
        activo: true,
      },
      {
        nombre: 'Cortes de Caja',
        descripcion: 'Realizar y ver cortes de caja',
        ruta: '/cortes',
        icono: 'fas fa-cut',
        activo: true,
      },
      {
        nombre: 'Gastos',
        descripcion: 'Registrar y gestionar gastos',
        ruta: '/gastos',
        icono: 'fas fa-money-bill-wave',
        activo: true,
      },
      {
        nombre: 'Configuración',
        descripcion: 'Configuración del sistema',
        ruta: '/configuracion',
        icono: 'fas fa-cog',
        activo: true,
      },
    ];

    for (const modulo of modulos) {
      const existe = await prisma.modulo.findUnique({
        where: { nombre: modulo.nombre },
      });

      if (!existe) {
        await prisma.modulo.create({
          data: modulo,
        });
        console.log(`✓ Módulo "${modulo.nombre}" creado`);
      } else {
        console.log(`- Módulo "${modulo.nombre}" ya existe`);
      }
    }

    console.log('\n✓ Módulos inicializados correctamente');
  } catch (error) {
    console.error('Error al inicializar módulos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initModulos();

