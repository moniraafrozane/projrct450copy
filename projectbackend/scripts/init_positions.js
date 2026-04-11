const prisma = require('../config/prisma');

const POSITIONS = [
  'Vice President',
  'General Secretary',
  'Event and Cultural Secretary',
  'Sport Secretary',
  'Publication Secretary',
  'Assistant Event and Cultural Secretary',
  'Executive Member'
];

async function initializePositions() {
  try {
    console.log('Initializing positions...');

    // Check if positions already exist
    const existingCount = await prisma.position.count();
    
    if (existingCount > 0) {
      console.log(`${existingCount} positions already exist in the database`);
      process.exit(0);
    }

    // Create all positions
    const createdPositions = await Promise.all(
      POSITIONS.map(title =>
        prisma.position.create({
          data: {
            title,
            description: `${title} Position`
          }
        })
      )
    );

    console.log(`✓ Successfully created ${createdPositions.length} positions:`);
    createdPositions.forEach(pos => console.log(`  - ${pos.title}`));
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error initializing positions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializePositions();
