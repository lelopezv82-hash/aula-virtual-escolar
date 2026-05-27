const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.update({
    where: { username: 'admin' },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log('Updated admin role to SUPER_ADMIN:', admin.username);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
