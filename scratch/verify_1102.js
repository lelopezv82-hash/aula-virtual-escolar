const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const g1102 = await prisma.gradeGroup.findFirst({
    where: { name: '02', grade: { name: '11' } }
  });

  const tasks = await prisma.task.findMany({
    where: {
      courseId: 'ce00cfe0-2cef-4a28-b005-450ae570cbab',
      period: 'Periodo 3',
      groups: { some: { id: g1102.id } }
    },
    include: {
      groups: true
    }
  });

  console.log(`Tareas encontradas para 11-02 en Periodo 3: ${tasks.length}`);
  tasks.forEach(t => {
    console.log(`- [${t.id}] "${t.title}" | Grupos: ${t.groups.map(g => g.name).join(', ')}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
