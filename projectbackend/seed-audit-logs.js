const prisma = require('./config/prisma');

async function seedAuditLogs() {
  try {
    console.log('🌱 Seeding audit logs...');

    // Get an admin user for demonstration
    const adminUser = await prisma.user.findFirst({
      where: { roles: { has: 'admin' } },
    });

    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating sample logs requires an admin user.');
      process.exit(1);
    }

    // Sample audit logs for different actions
    const sampleLogs = [
      {
        action: 'user_account_closed',
        module: 'user_management',
        description: 'User account closed: John Doe (john@example.com). Reason: Graduation from university',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'admin',
        resourceId: 'user-123',
        resourceType: 'User',
        resourceName: 'John Doe',
        previousValue: 'active',
        newValue: 'closed',
        metadata: {
          targetUserId: 'user-123',
          targetEmail: 'john@example.com',
          closureReason: 'Graduation from university',
          closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        action: 'application_approved',
        module: 'applications',
        description: 'Society application approved for society: Tech Club',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'admin',
        resourceId: 'app-001',
        resourceType: 'SocietyApplication',
        resourceName: 'Tech Club Application',
        previousValue: 'submitted',
        newValue: 'approved',
        metadata: {
          societyId: 'tech-club',
          approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        action: 'application_returned',
        module: 'applications',
        description: 'Society application returned for society: Drama Society. Notes: Please provide budget breakdown',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'admin',
        resourceId: 'app-002',
        resourceType: 'SocietyApplication',
        resourceName: 'Drama Society Application',
        previousValue: 'submitted',
        newValue: 'returned',
        metadata: {
          societyId: 'drama-society',
          adminNotes: 'Please provide budget breakdown',
          returnedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        action: 'certificate_uploaded',
        module: 'certificates',
        description: 'Certificate uploaded for student Ahmed Hassan in event Tech Summit 2026',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'society',
        resourceId: 'reg-045',
        resourceType: 'EventRegistration',
        resourceName: 'Ahmed Hassan - Tech Summit 2026',
        metadata: {
          eventId: 'evt-001',
          eventTitle: 'Tech Summit 2026',
          fileName: 'certificate_ahmed_hassan.pdf',
          fileSize: 245000,
        },
      },
      {
        action: 'certificate_approved',
        module: 'certificates',
        description: 'Certificate approved for student Fatima Khan in event Tech Summit 2026',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'society',
        resourceId: 'reg-046',
        resourceType: 'EventRegistration',
        resourceName: 'Fatima Khan - Tech Summit 2026',
        metadata: {
          eventId: 'evt-001',
          eventTitle: 'Tech Summit 2026',
          studentId: 'student-456',
          approvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        action: 'certificate_rejected',
        module: 'certificates',
        description: 'Certificate request rejected for student Ali Ahmed in event Tech Summit 2026',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'society',
        resourceId: 'reg-047',
        resourceType: 'EventRegistration',
        resourceName: 'Ali Ahmed - Tech Summit 2026',
        metadata: {
          eventId: 'evt-001',
          eventTitle: 'Tech Summit 2026',
          studentId: 'student-789',
          rejectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
      },
    ];

    // Create audit logs
    for (const log of sampleLogs) {
      await prisma.adminAuditLog.create({ data: log });
    }

    console.log(`✅ Created ${sampleLogs.length} sample audit logs`);
    console.log('📊 Visit http://localhost:3000/admin/audit-log to see all audit logs');
  } catch (error) {
    console.error('❌ Error seeding audit logs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAuditLogs();
