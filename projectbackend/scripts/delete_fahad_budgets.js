const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Find applications created by fahad with type budget_breakdown
    const applicationsToDelete = await prisma.societyApplication.findMany({
      where: {
        createdByName: 'fahad',
        type: 'budget_breakdown',
      },
    });

    console.log(`Found ${applicationsToDelete.length} budget breakdown applications from fahad:`);
    applicationsToDelete.forEach((app) => {
      console.log(`  - ID: ${app.id}, Subject: ${app.subject}, Status: ${app.status}`);
    });

    if (applicationsToDelete.length === 0) {
      console.log('No applications found to delete.');
      return;
    }

    // Delete the applications
    const result = await prisma.societyApplication.deleteMany({
      where: {
        createdByName: 'fahad',
        type: 'budget_breakdown',
      },
    });

    console.log(`\n✓ Successfully deleted ${result.count} applications.`);
  } catch (error) {
    console.error('Error deleting applications:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
