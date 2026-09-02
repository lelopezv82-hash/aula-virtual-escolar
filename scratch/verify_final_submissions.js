const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findUnique({
    where: { id: '572c326e-82ff-41a2-a02e-a22de14ec022' },
    include: {
      submissions: {
        include: {
          student: true
        }
      }
    }
  });

  console.log(`Tarea: "${task.title}" (ID: ${task.id})`);
  console.log(`Total entregas vinculadas en DB: ${task.submissions.length}`);
  task.submissions.forEach((s, idx) => {
    console.log(`${idx + 1}. Estudiante: ${s.student.name} | Status: ${s.status} | Archivo: ${s.fileUrl ? 'SÍ (Enlazado)' : 'NO'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
