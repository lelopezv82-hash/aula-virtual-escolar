const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const taskId = '5bcc6771-34b0-430b-aa56-7efc65580941';

  console.log('Inspecting task details for ID:', taskId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      groups: {
        select: {
          id: true,
          name: true,
          grade: { select: { name: true } }
        }
      }
    }
  });

  if (!task) {
    console.log('Task not found in DB!');
    return;
  }

  console.log('Task Title:', task.title);
  console.log('Task Type:', task.type);
  console.log('Task Period:', task.period);
  console.log('Task Groups:');
  task.groups.forEach(g => {
    console.log(`- Group ID: ${g.id}, Name: ${g.name}, Grade: ${g.grade?.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
