const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findUnique({
    where: { id: '4aade8a8-4138-4c3c-8c62-d75f11cf9ab1' }
  });
  console.log(JSON.stringify(task, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
