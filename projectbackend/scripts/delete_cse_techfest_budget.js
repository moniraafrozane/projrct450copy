const prisma = require('../config/prisma');

async function main() {
  try {
    console.log('Searching for CSE TechFest Additional Budget application...');

    // Find the CSE TechFest additional budget application
    const app = await prisma.societyApplication.findFirst({
      where: {
        subject: {
          contains: 'Additional Budget Breakdown — Application for approval of additional budget for'
        },
        OR: [
          { subject: { contains: 'cse techfest' } },
          { subject: { contains: 'CSE TechFest' } },
          { subject: { contains: 'cse tecfest' } },
          { subject: { contains: 'cse tech fest' } }
        ]
      },
      select: { id: true, subject: true, type: true, status: true, createdByName: true }
    });

    if (!app) {
      console.log('No matching application found. Trying alternative search...');
      
      const allBudgetApps = await prisma.societyApplication.findMany({
        where: {
          subject: {
            contains: 'Additional Budget Breakdown'
          }
        },
        select: { id: true, subject: true, type: true, status: true, createdByName: true }
      });

      console.log('All Additional Budget applications found:');
      allBudgetApps.forEach((a) => {
        console.log(`  - ${a.id}: ${a.subject} [${a.type}] (${a.status}) - Created by: ${a.createdByName}`);
      });

      return;
    }

    console.log('Found application:');
    console.log(`  ID: ${app.id}`);
    console.log(`  Subject: ${app.subject}`);
    console.log(`  Type: ${app.type}`);
    console.log(`  Status: ${app.status}`);
    console.log(`  Created by: ${app.createdByName}`);

    // Delete the application
    const deleteResult = await prisma.societyApplication.delete({
      where: { id: app.id }
    });

    console.log('\n✓ Successfully deleted the application!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
