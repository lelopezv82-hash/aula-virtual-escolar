const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("ENV DATABASE_URL:", process.env.DATABASE_URL);
  
  const tasks = await prisma.task.findMany({
    include: {
      course: {
        include: {
          teacher: true
        }
      }
    }
  });

  console.log(`\nFound ${tasks.length} tasks in database:`);
  tasks.forEach(t => {
    console.log(`- Task ID: ${t.id}`);
    console.log(`  Title: ${t.title}`);
    console.log(`  Period: ${t.period}`);
    console.log(`  Active: ${t.active}`);
    console.log(`  Course: ${t.course.name} (ID: ${t.courseId})`);
    console.log(`  Teacher: ${t.course.teacher.name} (ID: ${t.course.teacherId})`);
    console.log('----------------');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
