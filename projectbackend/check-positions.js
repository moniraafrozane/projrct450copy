const prisma = require('./config/prisma');

async function checkPositions() {
  try {
    const positions = await prisma.position.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        title: 'asc'
      }
    });

    console.log('\n=== Positions Status ===\n');
    
    if (positions.length === 0) {
      console.log('❌ No positions found in database. Run initialization first!');
    } else {
      positions.forEach(pos => {
        console.log(`Position: ${pos.title}`);
        console.log(`ID: ${pos.id}`);
        if (pos.user) {
          console.log(`✅ Assigned to: ${pos.user.name} (${pos.user.email})`);
        } else {
          console.log(`❌ Not assigned`);
        }
        console.log('---');
      });
    }

    console.log(`\nTotal positions: ${positions.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPositions();
