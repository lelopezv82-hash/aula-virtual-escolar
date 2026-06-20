const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const taskId = 'fa4d0856-3814-47b9-aa80-59eb32ce6542';
  
  // Find a student submission for this task
  const submission = await prisma.submission.findFirst({
    where: { taskId },
    include: { student: true }
  });

  if (!submission) {
    console.log("No submission found for this task.");
    return;
  }

  const studentId = submission.studentId;
  console.log(`Simulating GET for Student: ${submission.student.name} (ID: ${studentId})`);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            orderBy: { id: 'asc' }
          }
        }
      },
      submissions: {
        where: { studentId }
      }
    }
  });

  const sub = task.submissions[0];
  const isNative = task.questions && task.questions.length > 0;
  const canSeeAnswers = sub && sub.status !== "PENDING" && (isNative || sub.attempt > 1 || sub.unlockedAnswers === true);

  console.log("isNative:", isNative);
  console.log("submission status:", sub ? sub.status : "NO SUBMISSION");
  console.log("submission attempt:", sub ? sub.attempt : "N/A");
  console.log("submission unlockedAnswers:", sub ? sub.unlockedAnswers : "N/A");
  console.log("canSeeAnswers:", canSeeAnswers);

  if (!canSeeAnswers) {
    console.log("ANSWERS STRIPPED!");
  } else {
    console.log("ANSWERS NOT STRIPPED!");
    console.log("First question options (isCorrect flags):");
    for (const q of task.questions) {
      console.log(`  Question: ${q.text}`);
      for (const o of q.options) {
        console.log(`    Option: ${o.text} - isCorrect: ${o.isCorrect}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
