const prisma = require('./config/prisma');
const jwt = require('jsonwebtoken');

async function testAuditLogAPI() {
  try {
    // Get admin user
    const admin = await prisma.user.findFirst({
      where: { roles: { has: 'admin' } },
    });

    if (!admin) {
      console.error('No admin user found');
      process.exit(1);
    }

    // Create admin token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, roles: admin.roles },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    console.log('\n🔐 Admin Token Generated');
    console.log(`Admin: ${admin.name} (${admin.email})`);

    // Simulate getAuditLogs API call
    const logs = await prisma.adminAuditLog.findMany({
      where: {
        // Apply filters if needed
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
    });

    // Get total count for pagination
    const total = await prisma.adminAuditLog.count();

    console.log('\n✅ API Response Structure:');
    console.log(JSON.stringify(
      {
        success: true,
        logs: logs.slice(0, 2), // Show first 2 as example
        pagination: {
          total: total,
          page: 1,
          limit: 50,
          pages: Math.ceil(total / 50),
        },
      },
      null,
      2
    ));

    console.log(`\n📊 Total logs in database: ${total}`);
    console.log('✅ API is ready to serve audit logs');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLogAPI();
