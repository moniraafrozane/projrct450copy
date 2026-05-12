const prisma = require('../config/prisma');

async function main() {
  const prefixes = [
    'Budget Breakdown — ',
    'Budget Breakdown - ',
    'Budget breakdown - ',
    'Budget breakdown — ',
  ];

  console.log('Searching for applications with prefixed subjects...');

  const apps = await prisma.societyApplication.findMany({
    where: {
      OR: prefixes.map((p) => ({ subject: { startsWith: p } })),
    },
    select: { id: true, subject: true },
  });

  console.log(`Found ${apps.length} applications to normalize.`);

  for (const app of apps) {
    let newSubject = app.subject;
    for (const p of prefixes) {
      if (newSubject.startsWith(p)) {
        newSubject = newSubject.slice(p.length);
        break;
      }
    }

    // Trim any accidental leading punctuation or spaces
    newSubject = newSubject.replace(/^[:\-\s]+/, '');

    await prisma.societyApplication.update({
      where: { id: app.id },
      data: { subject: newSubject },
    });

    console.log(`Updated ${app.id}: "${app.subject}" -> "${newSubject}"`);
  }

  console.log('Normalization complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
