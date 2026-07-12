const prisma = require('./config/prisma');

async function cleanupTestAuditLogs() {
  try {
    const before = await prisma.adminAuditLog.count();

    const result = await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [
          { resourceId: { in: ['user-123', 'app-001', 'app-002', 'reg-045', 'reg-046', 'reg-047'] } },
          { description: { contains: 'Tech Summit 2026' } },
          { description: { contains: 'John Doe (john@example.com)' } },
          { description: { contains: 'Society application approved for society: Tech Club' } },
          { description: { contains: 'Society application returned for society: Drama Society' } }
        ]
      }
    });

    const after = await prisma.adminAuditLog.count();

    console.log('Cleanup complete');
    console.log(`Removed test logs: ${result.count}`);
    console.log(`Before: ${before}`);
    console.log(`After: ${after}`);
  } catch (error) {
    console.error('Failed to cleanup test logs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestAuditLogs();
