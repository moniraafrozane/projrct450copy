const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdminUsers() {
  try {
    console.log('Checking admin users...\n');
    
    // Find all users with admin role
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true
      }
    });

    const adminUsers = allUsers.filter(u => u.roles.includes('admin'));
    const nonAdminUsers = allUsers.filter(u => !u.roles.includes('admin'));

    console.log(`Total Users: ${allUsers.length}`);
    console.log(`Admin Users: ${adminUsers.length}`);
    console.log(`Non-Admin Users: ${nonAdminUsers.length}`);
    
    if (adminUsers.length > 0) {
      console.log('\n✓ Admin Users:');
      adminUsers.forEach(u => {
        console.log(`  - ${u.name} (${u.email}) - Roles: ${u.roles.join(', ')} - Active: ${u.isActive}`);
      });
    } else {
      console.log('\n⚠ No admin users found!');
    }

    console.log('\nNon-Admin Users (first 10):');
    nonAdminUsers.slice(0, 10).forEach(u => {
      console.log(`  - ${u.name} (${u.email}) - Roles: ${u.roles.join(', ')} - Active: ${u.isActive}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUsers();
