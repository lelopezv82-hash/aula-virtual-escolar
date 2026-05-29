const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findFirst({
    where: { name: { contains: 'Carlos Mendoza' } }
  });
  
  if (!teacher) {
    console.log('Teacher Carlos Mendoza not found.');
    return;
  }
  
  console.log('Teacher ID:', teacher.id);
  
  const tasks = await prisma.task.findMany({
    where: { course: { teacherId: teacher.id } },
    include: {
      course: true
    }
  });
  
  console.log('Tasks for teacher:', JSON.stringify(tasks.map(t => ({
    id: t.id,
    title: t.title,
    period: t.period,
    active: t.active,
    courseName: t.course.name
  })), null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
