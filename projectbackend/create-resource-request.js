const { PrismaClient } = require('@prisma/client');

(async () => {
  const p = new PrismaClient();
  try {
    // Get a society user to create the application for
    const user = await p.user.findFirst({
      where: { roles: { has: 'society' } }
    });

    if (!user) {
      console.log('No society user found to create application for');
      return;
    }

    // Create a resource_request application (Budget sent by society member)
    const app = await p.societyApplication.create({
      data: {
        type: 'resource_request',
        subject: 'Resource request for seminar materials',
        content: {
          itemsNeeded: ['Projector', 'Microphone', 'Whiteboard markers'],
          purpose: 'We need these items for our upcoming seminar',
          quantity: 3,
          budget: 5000
        },
        status: 'submitted',
        createdById: user.id,
        createdByName: user.name
      }
    });

    console.log('✓ Created test resource_request application:');
    console.log(JSON.stringify(app, null, 2));
  } finally {
    await p.$disconnect();
  }
})();
