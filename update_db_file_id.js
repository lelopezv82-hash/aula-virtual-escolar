const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courseId = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
  const period = 'Periodo 1';
  const fileId = '1mAM7GKDDgnEREbHW4IplvGIJFZmvXDrH';
  const accountId = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';

  console.log('Updating database course association...');

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { gDriveSyncFiles: true }
  });

  const existingSyncFiles = course.gDriveSyncFiles || {};
  const updatedSyncFiles = {
    ...existingSyncFiles,
    [period]: {
      fileId,
      accountId
    }
  };

  await prisma.course.update({
    where: { id: courseId },
    data: {
      gDriveSyncFiles: updatedSyncFiles
    }
  });

  console.log('Successfully updated course association to fileId:', fileId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
