const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.submission.findMany({
    include: { task: true, student: true }
  });
  console.log(JSON.stringify(subs.map(s => ({
    id: s.id,
    taskId: s.taskId,
    taskTitle: s.task.title,
    studentName: s.student.name,
    status: s.status,
    grade: s.grade,
    feedback: s.feedback,
    submittedAt: s.submittedAt
  })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
