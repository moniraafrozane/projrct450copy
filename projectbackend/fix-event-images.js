require('dotenv').config();
const prisma = require('./config/prisma');

async function fixEventImages() {
  try {
    // Get events with null or empty bannerImage
    const eventsWithoutImage = await prisma.event.findMany({
      where: {
        OR: [
          { bannerImage: null },
          { bannerImage: '' }
        ]
      },
      select: {
        id: true,
        title: true
      }
    });

    console.log(`Found ${eventsWithoutImage.length} events without banner images`);

    // You can manually update them here
    // Example: Update a specific event
    // await prisma.event.update({
    //   where: { id: 'EVENT_ID_HERE' },
    //   data: { bannerImage: 'http://localhost:5000/uploads/images/your-image.png' }
    // });

    console.log('\nEvents without images:');
    eventsWithoutImage.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.id})`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixEventImages();
