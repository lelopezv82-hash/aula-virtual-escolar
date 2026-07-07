const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentId = '51e32186-679f-4ad0-91c9-9a95bb57176b';
  const courseId = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
  const period = 'Periodo 1';

  console.log('Checking submissions for Misael Jose...');

  const submissions = await prisma.submission.findMany({
    where: {
      studentId,
      task: {
        courseId,
        period
      }
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          type: true
        }
      }
    }
  });

  console.log(`Found ${submissions.length} submissions:`);
  submissions.forEach(s => {
    console.log(`- Task ID: ${s.taskId}\n  Title: "${s.task.title}"\n  Type: ${s.task.type}\n  Grade: ${s.grade}\n  Status: ${s.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
