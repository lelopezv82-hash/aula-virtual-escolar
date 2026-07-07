const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentId = '51e32186-679f-4ad0-91c9-9a95bb57176b';
  const taskId = '5bcc6771-34b0-430b-aa56-7efc65580941'; // SER 8 task ID

  console.log('Testing transaction upsert for Misael Jose...');

  try {
    const res = await prisma.$transaction(async (tx) => {
      const result = await tx.submission.upsert({
        where: { taskId_studentId: { taskId, studentId } },
        update: {
          grade: 4.0,
          status: 'GRADED',
          updatedAt: new Date()
        },
        create: {
          taskId,
          studentId,
          grade: 4.0,
          status: 'GRADED',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return result;
    });
    console.log('Success! Result:', JSON.stringify(res));
  } catch (err) {
    console.error('Error running transaction:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
