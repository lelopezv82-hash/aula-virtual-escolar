const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Carlos Mendoza' } }
  });
  console.log('Carlos Mendoza:', user);
  await prisma.$disconnect();
}

main().catch(console.error);
