const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      questions: {
        some: {}
      }
    },
    include: {
      questions: {
        include: {
          options: true
        }
      },
      submissions: true
    }
  });

  console.log(`Found ${tasks.length} tasks with questions.`);
  for (const t of tasks) {
    console.log(`\n===================================`);
    console.log(`Task: ${t.title} (ID: ${t.id})`);
    console.log(`Questions:`);
    for (const q of t.questions) {
      console.log(`  Question ID: ${q.id} - Text: "${q.text}"`);
      for (const o of q.options) {
        console.log(`    Option ID: ${o.id} - Text: "${o.text}" - isCorrect: ${o.isCorrect}`);
      }
    }
    console.log(`Submissions:`);
    for (const s of t.submissions) {
      console.log(`  Sub ID: ${s.id} - Grade: ${s.grade} - Status: ${s.status}`);
      console.log(`  Feedback: ${s.feedback}`);
      console.log(`  Answers: ${JSON.stringify(s.answers)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
