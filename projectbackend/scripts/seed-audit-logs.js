const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const actions = [
  {
    action: 'certificate_uploaded',
    module: 'certificates',
    description: 'Certificate uploaded for student John Doe in event Innovation Week',
    actorEmail: 'society@example.com',
    actorName: 'Sarah Smith',
    actorRole: 'society',
    resourceType: 'EventRegistration',
    resourceName: 'John Doe - Innovation Week',
    metadata: { eventId: '1', eventTitle: 'Innovation Week', fileName: 'cert.pdf', fileSize: 245000 },
  },
  {
    action: 'certificate_approved',
    module: 'certificates',
    description: 'Certificate approved for student Jane Wilson in event Tech Summit',
    actorEmail: 'society@example.com',
    actorName: 'Sarah Smith',
    actorRole: 'society',
    resourceType: 'EventRegistration',
    resourceName: 'Jane Wilson - Tech Summit',
    metadata: { eventId: '2', eventTitle: 'Tech Summit', studentId: 'user2', approvedAt: new Date().toISOString() },
  },
  {
    action: 'certificate_rejected',
    module: 'certificates',
    description: 'Certificate request rejected for student Mike Chen in event Leadership Retreat',
    actorEmail: 'society@example.com',
    actorName: 'Alex Johnson',
    actorRole: 'society',
    resourceType: 'EventRegistration',
    resourceName: 'Mike Chen - Leadership Retreat',
    metadata: { eventId: '3', eventTitle: 'Leadership Retreat', studentId: 'user3', rejectedAt: new Date().toISOString() },
  },
  {
    action: 'certificate_uploaded',
    module: 'certificates',
    description: 'Certificate uploaded for student Emma Davis in event Workshop Series',
    actorEmail: 'admin@example.com',
    actorName: 'Admin User',
    actorRole: 'admin',
    resourceType: 'EventRegistration',
    resourceName: 'Emma Davis - Workshop Series',
    metadata: { eventId: '4', eventTitle: 'Workshop Series', fileName: 'cert-emma.pdf', fileSize: 320000 },
  },
  {
    action: 'certificate_approved',
    module: 'certificates',
    description: 'Certificate approved for student Robert Brown in event Networking Night',
    actorEmail: 'society@example.com',
    actorName: 'Sarah Smith',
    actorRole: 'society',
    resourceType: 'EventRegistration',
    resourceName: 'Robert Brown - Networking Night',
    metadata: { eventId: '5', eventTitle: 'Networking Night', studentId: 'user5', approvedAt: new Date().toISOString() },
  },
];

async function seedAuditLogs() {
  try {
    console.log('Clearing existing audit logs...');
    await prisma.adminAuditLog.deleteMany();
    console.log('✓ Cleared');

    console.log('\nSeeding test audit logs...');
    
    // Create logs with staggered timestamps (last 5 days)
    const now = new Date();
    
    for (let i = 0; i < actions.length; i++) {
      const timestamp = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Each day earlier
      
      const log = await prisma.adminAuditLog.create({
        data: {
          ...actions[i],
          actorId: `user-${i}`,
          resourceId: `reg-${i}`,
          createdAt: timestamp,
        },
      });
      
      console.log(`✓ Created: ${log.action} by ${log.actorName} (${log.createdAt.toLocaleDateString()})`);
    }

    console.log('\n✅ Audit logs seeded successfully!');
    console.log(`Total logs created: ${actions.length}`);
    console.log('\nVisit http://localhost:3000/admin/audit-log to view the logs');
  } catch (error) {
    console.error('Error seeding audit logs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAuditLogs();
