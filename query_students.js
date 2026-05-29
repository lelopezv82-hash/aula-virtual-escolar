const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      name: true,
      username: true,
      groupId: true
    }
  });
  console.log('Students in database:', JSON.stringify(students, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
