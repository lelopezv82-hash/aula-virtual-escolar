const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking database for users and resources...');
  
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      googleDriveFolderId: true,
      googleRefreshToken: true,
    }
  });

  console.log('\n--- Teachers ---');
  teachers.forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`Name: ${t.name}`);
    console.log(`Email: ${t.email}`);
    console.log(`Drive Folder ID: ${t.googleDriveFolderId}`);
    console.log(`Has Refresh Token: ${t.googleRefreshToken ? 'YES' : 'NO'}`);
    console.log('----------------');
  });

  const resources = await prisma.recurso.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n--- Last 5 Resources ---');
  resources.forEach(r => {
    console.log(JSON.stringify(r, null, 2));
    console.log('----------------');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
