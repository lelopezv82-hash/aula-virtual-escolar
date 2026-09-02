const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gdrive = await prisma.googleDriveAccount.findMany();
  console.log('GDrive Accounts:', gdrive.length);

  const course = await prisma.course.findUnique({
    where: { id: 'ce00cfe0-2cef-4a28-b005-450ae570cbab' }
  });
  console.log('Course gDriveSyncFiles:', course?.gDriveSyncFiles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
