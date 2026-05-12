const prisma = require('../config/prisma');

async function main() {
  const searchText = 'cse techfest';

  console.log(`Searching for applications with "${searchText}" in subject...`);

  const apps = await prisma.societyApplication.findMany({
    where: {
      subject: { contains: searchText },
    },
    select: { id: true, subject: true, type: true, status: true, createdByName: true },
  });

  if (apps.length === 0) {
    console.log('No matching applications found.');
    return;
  }

  console.log(`Found ${apps.length} application(s):`);
  apps.forEach((a) => console.log(`  - ${a.id}: "${a.subject}" [${a.type}] (${a.status}) by ${a.createdByName}`));

  const prefixes = ['Budget Breakdown — ', 'Budget Breakdown - ', 'Budget breakdown - ', 'Budget breakdown — '];

  for (const app of apps) {
    let newSubject = app.subject;
    
    // Remove leading prefixes
    for (const p of prefixes) {
      if (newSubject.startsWith(p)) {
        newSubject = newSubject.slice(p.length);
        break;
      }
    }

    // Trim extra spaces/punctuation
    newSubject = newSubject.replace(/^[:\-\s]+/, '').trim();

    if (newSubject !== app.subject) {
      await prisma.societyApplication.update({
        where: { id: app.id },
        data: { subject: newSubject },
      });
      console.log(`✓ Updated ${app.id}:`);
      console.log(`  OLD: "${app.subject}"`);
      console.log(`  NEW: "${newSubject}"`);
    } else {
      console.log(`✓ No changes needed for ${app.id} (already correct)`);
    }
  }

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
