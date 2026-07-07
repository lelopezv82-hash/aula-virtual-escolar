const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: { name: 'fisica' },
    select: {
      id: true,
      name: true,
      gDriveSyncFiles: true,
      teacherId: true
    }
  });
  console.log('Courses:', JSON.stringify(courses, null, 2));
}

main().catch(console.error);
