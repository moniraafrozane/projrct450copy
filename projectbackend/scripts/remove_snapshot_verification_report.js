const prisma = require('../config/prisma');

async function main() {
  const title = 'Admin Snapshot Verification';

  const existing = await prisma.analyticsReport.findMany({
    where: { title },
    select: { id: true, title: true, reportYear: true, createdAt: true },
  });

  console.log('Matching reports before delete:', existing.length);
  if (existing.length) {
    console.log(existing);
  }

  const deleted = await prisma.analyticsReport.deleteMany({
    where: { title },
  });

  console.log('Deleted count:', deleted.count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
