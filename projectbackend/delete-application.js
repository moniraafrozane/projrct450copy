const prisma = require('./config/prisma');

async function deleteApplication() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node delete-application.js <application-id>');
    process.exit(1);
  }

  try {
    console.log(`Deleting application ${id}...`);
    const app = await prisma.societyApplication.findUnique({ where: { id } });
    if (!app) {
      console.log('Application not found. Nothing to delete.');
      process.exit(0);
    }

    await prisma.societyApplication.delete({ where: { id } });
    console.log('✓ Application deleted successfully');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error deleting application:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteApplication();
