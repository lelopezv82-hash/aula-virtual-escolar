const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.googleDriveAccount.findMany({
    select: {
      id: true,
      email: true,
      googleDriveFolderId: true,
      userId: true
    }
  });
  console.log('Google Drive Accounts:', JSON.stringify(accounts, null, 2));
}

main().catch(console.error);
