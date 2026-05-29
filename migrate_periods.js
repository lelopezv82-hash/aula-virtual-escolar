const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting period normalization migration...");

  // Update tasks
  const tasks = await prisma.task.findMany();
  let updatedTasksCount = 0;
  for (const t of tasks) {
    if (t.period === '1' || t.period === '2' || t.period === '3' || t.period === '4') {
      const normalizedPeriod = `Periodo ${t.period}`;
      await prisma.task.update({
        where: { id: t.id },
        data: { period: normalizedPeriod }
      });
      console.log(`Updated Task "${t.title}" period from "${t.period}" to "${normalizedPeriod}"`);
      updatedTasksCount++;
    }
  }

  // Update resources
  const resources = await prisma.resource.findMany();
  let updatedResourcesCount = 0;
  for (const r of resources) {
    if (r.period === '1' || r.period === '2' || r.period === '3' || r.period === '4') {
      const normalizedPeriod = `Periodo ${r.period}`;
      await prisma.resource.update({
        where: { id: r.id },
        data: { period: normalizedPeriod }
      });
      console.log(`Updated Resource "${r.title}" period from "${r.period}" to "${normalizedPeriod}"`);
      updatedResourcesCount++;
    }
  }

  console.log(`Migration finished. Updated ${updatedTasksCount} tasks and ${updatedResourcesCount} resources.`);
  await prisma.$disconnect();
}

main().catch(console.error);
