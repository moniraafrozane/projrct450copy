const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateVenueForUpcomingEvents() {
  try {
    console.log('🔄 Updating venue for all upcoming events...');

    // Get current date to filter upcoming events
    const now = new Date();

    // Find all upcoming events (events with eventDate in the future)
    const upcomingEvents = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: now
        }
      },
      select: {
        id: true,
        title: true,
        venue: true,
        eventDate: true
      }
    });

    console.log(`\nFound ${upcomingEvents.length} upcoming event(s)\n`);

    if (upcomingEvents.length === 0) {
      console.log('No upcoming events to update.');
      return;
    }

    // Display events that will be updated
    console.log('Events to be updated:');
    upcomingEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Current venue: ${event.venue}`);
      console.log(`   Event date: ${event.eventDate.toLocaleDateString()}`);
      console.log('');
    });

    // Update all upcoming events to have the new venue
    const result = await prisma.event.updateMany({
      where: {
        eventDate: {
          gte: now
        }
      },
      data: {
        venue: 'CSE lab 629'
      }
    });

    console.log(`✅ Successfully updated ${result.count} event(s)`);
    console.log('All upcoming events now have venue: CSE lab 629\n');

    // Verify the updates
    const updatedEvents = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: now
        }
      },
      select: {
        title: true,
        venue: true,
        eventDate: true
      }
    });

    console.log('Updated events:');
    updatedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} - Venue: ${event.venue} - Date: ${event.eventDate.toLocaleDateString()}`);
    });

  } catch (error) {
    console.error('❌ Error updating venues:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateVenueForUpcomingEvents()
  .then(() => {
    console.log('\n✨ Venue update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update venues:', error);
    process.exit(1);
  });
