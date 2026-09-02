const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findUnique({
    where: { id: 'ce00cfe0-2cef-4a28-b005-450ae570cbab' },
    include: {
      groups: {
        include: { grade: true }
      }
    }
  });

  console.log(`Grupos asignados al curso "${course.name}":`);
  course.groups.forEach(g => {
    console.log(`- Grado ${g.grade?.name} — Grupo ${g.name} (id: ${g.id})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
