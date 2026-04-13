const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showPositions() {
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

    console.log('\n=== Current Positions Status ===\n');
    
    positions.forEach(pos => {
      console.log(`📌 ${pos.title}`);
      if (pos.user) {
        console.log(`   ✅ Assigned to: ${pos.user.name} (${pos.user.email})`);
      } else {
        console.log(`   ⚪ Available`);
      }
    });

    console.log(`\n📊 Total: ${positions.length} positions`);
    console.log(`✅ Assigned: ${positions.filter(p => p.user).length}`);
    console.log(`⚪ Available: ${positions.filter(p => !p.user).length}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showPositions();
