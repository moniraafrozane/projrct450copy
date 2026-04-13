const prisma = require('./config/prisma');

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        roles: true,
        isActive: true,
        name: true
      }
    });
    
    console.log('Users in database:');
    console.log(JSON.stringify(users, null, 2));
    console.log(`\nTotal users: ${users.length}`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkUsers();
