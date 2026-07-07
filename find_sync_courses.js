const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      name: true,
      gDriveSyncFiles: true
    }
  });
  const filtered = courses.filter(c => c.gDriveSyncFiles && Object.keys(c.gDriveSyncFiles).length > 0);
  console.log('Courses with sync files:', JSON.stringify(filtered, null, 2));
}

main().catch(console.error);
