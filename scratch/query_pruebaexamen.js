const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findFirst({
    where: { title: { contains: 'pruebaexamen' } },
    include: {
      submissions: {
        include: {
          student: true
        }
      }
    }
  });
  console.log('Task and submissions for pruebaexamen:', JSON.stringify(task, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
