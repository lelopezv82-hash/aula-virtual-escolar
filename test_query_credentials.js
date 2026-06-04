const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      name: true,
      username: true,
      passwordPlain: true,
      group: {
        select: {
          name: true,
          grade: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(students, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
