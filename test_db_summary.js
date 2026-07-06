const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const usersCount = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true }
  });
  console.log('=== User roles ===');
  usersCount.forEach(u => console.log(`${u.role}: ${u._count.id}`));

  const courses = await prisma.course.findMany({
    select: { id: true, name: true, teacher: { select: { name: true } } }
  });
  console.log('\n=== Courses ===');
  courses.forEach(c => console.log(`${c.name} (Teacher: ${c.teacher.name})`));

  const periods = await prisma.period.findMany();
  console.log('\n=== Periods ===');
  periods.forEach(p => console.log(`${p.name} (Active: ${p.active})`));

  const users = await prisma.user.findMany({
    select: { name: true, username: true, role: true, passwordPlain: true },
    orderBy: { role: 'asc' }
  });
  console.log('\n=== Users details ===');
  users.forEach(u => console.log(`[${u.role}] ${u.name} (Username: ${u.username}, Pass: ${u.passwordPlain})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
