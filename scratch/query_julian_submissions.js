const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentId = '471f69e7-769e-4ff0-8b07-06dd0b72558c';
  const submissions = await prisma.submission.findMany({
    where: { studentId },
    include: {
      task: true
    }
  });
  console.log('Submissions for Julián Martínez:', JSON.stringify(submissions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
