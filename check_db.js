const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'CARRASCAL' } }
  });
  console.log('User:', user?.id, user?.name);

  const subs = await prisma.submission.findMany({
    where: { studentId: user?.id },
    include: { task: true }
  });

  console.log('Submissions:', subs.map(s => ({
    id: s.id,
    taskId: s.taskId,
    taskTitle: s.task.title,
    status: s.status,
    grade: s.grade,
    feedback: s.feedback
  })));
}

main().finally(() => prisma.$disconnect());
