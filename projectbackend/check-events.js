require('dotenv').config();
const prisma = require('./config/prisma');

async function checkEvents() {
  try {
    const events = await prisma.event.findMany({
      select: {
        id: true,
        title: true,
        bannerImage: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log('\n=== Recent Events ===');
    console.log('Total events:', events.length);
    console.log('\nEvent details:');
    
    events.forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.title}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Banner: ${event.bannerImage || 'NULL'}`);
      console.log(`   Created: ${event.createdAt}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkEvents();
