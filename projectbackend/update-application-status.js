const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateApplicationStatus() {
  try {
    console.log('Connecting to database...');
    
    const applicationId = '923ca7a4-b245-4d05-a8b9-35c1fcb8bb9f';
    
    const updated = await prisma.societyApplication.update({
      where: { id: applicationId },
      data: { status: 'submitted' }
    });

    console.log('✓ Application status updated to "submitted"');
    console.log('\nUpdated Application:');
    console.log(`  ID: ${updated.id}`);
    console.log(`  Status: ${updated.status}`);
    console.log(`  Type: ${updated.type}`);
    console.log(`  Subject: ${updated.subject}`);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateApplicationStatus();
