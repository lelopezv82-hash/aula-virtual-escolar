const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task903 = await prisma.task.findUnique({
    where: { id: '519b58bc-c5c1-40da-b1a7-ed48245fd0da' },
    include: {
      submissions: {
        include: {
          student: {
            include: {
              group: { include: { grade: true } }
            }
          }
        }
      }
    }
  });

  console.log(`Task "Taller 1 Excel basico" submissions: ${task903?.submissions.length}`);
  task903?.submissions.forEach(s => {
    console.log(`Estudiante: ${s.student?.name} | Grupo: ${s.student?.group?.grade?.name}-${s.student?.group?.name} | Nota: ${s.grade}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
