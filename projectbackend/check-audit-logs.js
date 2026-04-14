const prisma = require('./config/prisma');

async function checkAuditLogs() {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📊 Audit Logs in Database:');
    console.log(`Total logs: ${logs.length}\n`);

    logs.forEach((log, index) => {
      console.log(`[${index + 1}] ${log.action} | ${log.module} | ${log.description}`);
      console.log(`    Actor: ${log.actorName} (${log.actorEmail})`);
      console.log(`    Time: ${log.createdAt}\n`);
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAuditLogs();
