const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'TEACHER' }
  });
  console.log('Teachers in database:');
  users.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}`));

  const courses = await prisma.course.findMany({
    include: {
      tasks: true
    }
  });

  console.log('\nAll Courses and Task counts:');
  courses.forEach(c => {
    console.log(`- Course ID: ${c.id}, Name: ${c.name}, Teacher ID: ${c.teacherId}, Tasks Count: ${c.tasks.length}`);
    c.tasks.forEach(t => {
      console.log(`   * Task: ${t.title}, Period: ${t.period}, Active: ${t.active}`);
    });
  });

  const totalTasks = await prisma.task.count();
  console.log(`\nTotal Tasks in DB: ${totalTasks}`);

  await prisma.$disconnect();
}

main().catch(console.error);
