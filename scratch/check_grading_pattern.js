const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const g1101Subs = await prisma.submission.findMany({
    where: { task: { title: 'Taller conceptual sobre Excel' } },
    include: { student: true }
  });
  console.log('=== CALIFICACIONES EN 11-01 ("Taller conceptual sobre Excel") ===');
  g1101Subs.forEach(s => {
    console.log(`${s.student.name} -> Nota: ${s.grade} | Status: ${s.status}`);
  });

  const g1103Subs = await prisma.submission.findMany({
    where: { task: { title: 'Taller 1 Excel básico' } },
    include: { student: true }
  });
  console.log('\n=== CALIFICACIONES EN 11-03 ("Taller 1 Excel básico") ===');
  g1103Subs.forEach(s => {
    console.log(`${s.student.name} -> Nota: ${s.grade} | Status: ${s.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
