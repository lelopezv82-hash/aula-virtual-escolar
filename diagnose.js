const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Periodos actuales
  const periods = await prisma.period.findMany({ orderBy: { name: 'asc' } });
  console.log('\n=== PERIODOS EN BD ===');
  periods.forEach(p => console.log(`  ${p.name} | active=${p.active}`));

  // Tareas con su periodo y estado
  const tasks = await prisma.task.findMany({ select: { title: true, period: true, active: true }, orderBy: { createdAt: 'asc' } });
  console.log('\n=== TAREAS (period, active) ===');
  tasks.forEach(t => console.log(`  "${t.title}" | period="${t.period}" | active=${t.active}`));

  // Periodos que tienen tareas
  const periodValues = [...new Set(tasks.map(t => t.period).filter(Boolean))];
  const periodNames = periods.map(p => p.name);
  console.log('\n=== PERIODOS EN TAREAS SIN MATCH ===');
  periodValues.filter(v => !periodNames.includes(v)).forEach(v => console.log(`  "${v}" NO EXISTE en tabla Period`));
}

main().catch(console.error).finally(() => process.exit());
