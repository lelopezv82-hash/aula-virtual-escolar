const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT id, name, "gDriveSyncFiles" FROM "Course"`;
  console.log('Raw SQL Database Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
