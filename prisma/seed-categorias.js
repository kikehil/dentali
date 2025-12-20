const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando categorías iniciales...');

  const categorias = [
    { nombre: 'General', descripcion: 'Servicios generales de odontología', color: '#3b82f6' },
    { nombre: 'Estético', descripcion: 'Servicios de estética dental', color: '#ec4899' },
    { nombre: 'Cirugía', descripcion: 'Procedimientos quirúrgicos', color: '#ef4444' },
    { nombre: 'Ortodoncia', descripcion: 'Tratamientos de ortodoncia', color: '#8b5cf6' },
    { nombre: 'Preventivo', descripcion: 'Servicios preventivos y limpieza', color: '#10b981' },
    { nombre: 'Restaurativo', descripcion: 'Restauraciones y empastes', color: '#f59e0b' },
    { nombre: 'Endodoncia', descripcion: 'Tratamientos de endodoncia', color: '#6366f1' },
    { nombre: 'Periodoncia', descripcion: 'Tratamientos periodontales', color: '#14b8a6' },
  ];

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: categoria.nombre },
      update: categoria,
      create: categoria,
    });
    console.log(`✓ Categoría "${categoria.nombre}" creada/actualizada`);
  }

  console.log('¡Categorías sembradas exitosamente!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




