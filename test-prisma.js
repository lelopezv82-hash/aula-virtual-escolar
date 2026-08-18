const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.googleDriveAccount.update({
      where: { id: 'some-id', userId: 'some-user-id' },
      data: { customLimit: 100 }
    });
    console.log('Success');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
