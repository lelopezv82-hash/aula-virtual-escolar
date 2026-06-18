const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Credentials for pedro perez and marcos rozo:');
  const users = await prisma.user.findMany({
    where: {
      name: { in: ['pedro perez', 'marcos rozo'], mode: 'insensitive' }
    }
  });

  users.forEach(u => {
    console.log(`Name: ${u.name}`);
    console.log(`Username: ${u.username}`);
    console.log(`Password Plain: ${u.passwordPlain}`);
    console.log(`Role: ${u.role}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
