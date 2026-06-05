const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const periods = await prisma.period.findMany({ orderBy: { name: 'asc' } });
  console.log('Periodos en BD:', JSON.stringify(periods, null, 2));
}

main().catch(console.error).finally(() => process.exit());
