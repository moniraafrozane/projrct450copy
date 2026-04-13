const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const p = new PrismaClient();
  try {
    const password = 'test123';
    const hashed = await bcrypt.hash(password, 12);
    
    // Create a test student user
    const user = await p.user.create({
      data: {
        name: 'Test Student',
        email: 'test@gmail.com',
        password: hashed,
        phone: '1234567890',
        roles: ['student'],
        studentId: 'TST001',
        program: 'Computer Science',
        year: 1,
        isActive: true
      }
    });
    
    console.log('✓ Test student created:', { id: user.id, email: user.email, roles: user.roles });
    
    // Create a test society user
    const societyUser = await p.user.create({
      data: {
        name: 'Test Society Member',
        email: 'society@gmail.com',
        password: hashed,
        phone: '9876543210',
        roles: ['society'],
        societyName: 'Computer Science Society',
        societyRole: 'President',
        isActive: true
      }
    });
    
    console.log('✓ Test society user created:', { id: societyUser.id, email: societyUser.email, roles: societyUser.roles });
    
    // Create a test admin user
    const adminUser = await p.user.create({
      data: {
        name: 'Test Admin',
        email: 'admin@gmail.com',
        password: hashed,
        phone: '5555555555',
        roles: ['admin'],
        isActive: true
      }
    });
    
    console.log('✓ Test admin user created:', { id: adminUser.id, email: adminUser.email, roles: adminUser.roles });
    
    console.log('\n✓ All test users created successfully!');
    console.log('\nTest credentials:');
    console.log('Student: test@gmail.com / test123');
    console.log('Society: society@gmail.com / test123');
    console.log('Admin: admin@gmail.com / test123');
    
  } catch (e) {
    if (e.code === 'P2002') {
      console.log('✓ Users already exist, skipping creation');
    } else {
      console.error('✗ Error creating test users:', e.message);
      process.exit(1);
    }
  } finally {
    await p.$disconnect();
  }
})();
