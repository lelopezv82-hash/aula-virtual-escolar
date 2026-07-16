const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.submission.updateMany({
    where: {
      status: 'PENDING',
      grade: { not: null }
    },
    data: {
      status: 'GRADED'
    }
  });
  console.log(`Updated ${result.count} submissions to GRADED.`);
}

main().finally(() => prisma.$disconnect());
