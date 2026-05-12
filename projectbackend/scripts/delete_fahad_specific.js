const prisma = require('../config/prisma');

async function main() {
  const creator = 'fahad';
  const targets = [
    'Budget Breakdown — Additional Budget Breakdown — Application for approval of additional budget for the event',
    'Budget Breakdown — Budget Breakdown — Application for approval of additional budget for Career Talk for CSE Students',
    'Budget Breakdown — Application for approval of CSE Cricket Tournament',
  ];

  console.log('Searching for matching applications created by', creator);

  const apps = await prisma.societyApplication.findMany({
    where: {
      createdByName: creator,
      OR: targets.map((s) => ({ subject: s })),
    },
    select: { id: true, subject: true, type: true, status: true },
  });

  if (apps.length === 0) {
    console.log('No exact-match applications found. Trying partial matches...');
    const partialApps = await prisma.societyApplication.findMany({
      where: {
        createdByName: creator,
        OR: [
          { subject: { contains: 'Application for approval of additional budget for' } },
          { subject: { contains: 'Application for approval of CSE Cricket Tournament' } },
        ],
      },
      select: { id: true, subject: true, type: true, status: true },
    });

    if (partialApps.length === 0) {
      console.log('No matching applications found. Nothing to delete.');
      return;
    }

    console.log(`Found ${partialApps.length} partial-match applications:`);
    partialApps.forEach((a) => console.log(`  - ${a.id}: ${a.subject} [${a.type}] (${a.status})`));

    const deleteResult = await prisma.societyApplication.deleteMany({
      where: {
        id: { in: partialApps.map((a) => a.id) },
      },
    });

    console.log(`Deleted ${deleteResult.count} applications (partial matches).`);
    return;
  }

  console.log(`Found ${apps.length} exact-match applications:`);
  apps.forEach((a) => console.log(`  - ${a.id}: ${a.subject} [${a.type}] (${a.status})`));

  const ids = apps.map((a) => a.id);
  const result = await prisma.societyApplication.deleteMany({ where: { id: { in: ids } } });

  console.log(`Deleted ${result.count} applications.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
