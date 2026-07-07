const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courseId = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
  const groupId = '4245edb5-50b5-4746-9c5b-29c6f2378ac6';
  const period = 'Periodo 1';

  console.log('Printing active tasks for course, period, and group...');

  const tasks = await prisma.task.findMany({
    where: {
      courseId,
      period,
      active: true,
      groups: { some: { id: groupId } }
    },
    select: {
      id: true,
      title: true,
      type: true,
      active: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${tasks.length} active tasks:`);
  tasks.forEach((t, i) => {
    console.log(`${i+1}. ID: ${t.id}, Title: "${t.title}", Type: ${t.type}, Active: ${t.active}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
