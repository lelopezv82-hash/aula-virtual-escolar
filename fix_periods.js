const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Reactivar Periodo 1-2
  const updated = await prisma.period.updateMany({
    where: { name: 'Periodo 1-2' },
    data: { active: true }
  });
  console.log('Periodos reactivados:', updated.count);

  // Reactivar todas las tareas de Periodo 1-2
  const tasks = await prisma.task.updateMany({
    where: { period: 'Periodo 1-2' },
    data: { active: true }
  });
  console.log('Tareas reactivadas:', tasks.count);

  // Reactivar recursos de Periodo 1-2 si hay
  const resources = await prisma.resource.updateMany({
    where: { period: 'Periodo 1-2' },
    data: { active: true }
  });
  console.log('Recursos reactivados:', resources.count);

  // Verificar estado final
  const periods = await prisma.period.findMany({ orderBy: { name: 'asc' } });
  console.log('\n=== ESTADO FINAL PERIODOS ===');
  periods.forEach(p => console.log(`  ${p.name} | active=${p.active}`));
}

main().catch(console.error).finally(() => process.exit());
