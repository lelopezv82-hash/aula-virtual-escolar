require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      student: { select: { name: true } },
      status: true,
      grade: true,
      feedback: true,
      createdAt: true,
      submittedAt: true
    }
  });

  console.log(JSON.stringify(submissions, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
