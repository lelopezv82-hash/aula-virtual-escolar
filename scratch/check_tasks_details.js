const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t1 = await prisma.task.findUnique({
    where: { id: '37c2031e-c63b-4819-828c-2a7c2782dfe7' },
    include: { questions: { include: { options: true } } }
  });
  console.log('--- Tarea 11-03 ("Taller 1 Excel básico") ---');
  console.log({
    title: t1.title,
    type: t1.type,
    period: t1.period,
    dueDate: t1.dueDate,
    description: t1.description,
    questionsCount: t1.questions.length,
    attachmentUrl: t1.attachmentUrl
  });

  const t2 = await prisma.task.findUnique({
    where: { id: 'ee243904-a751-4d74-ab90-d486c8c87857' },
    include: { questions: { include: { options: true } } }
  });
  console.log('\n--- Tarea 11-01 ("Taller conceptual sobre Excel") ---');
  console.log({
    title: t2.title,
    type: t2.type,
    period: t2.period,
    dueDate: t2.dueDate,
    description: t2.description,
    questionsCount: t2.questions.length,
    attachmentUrl: t2.attachmentUrl
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
