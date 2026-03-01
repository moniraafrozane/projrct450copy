const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
(async () => {
  const p = new PrismaClient();
  try {
    const password = 'Password123!';
    const hashed = await bcrypt.hash(password, 12);
    const user = await p.user.create({ data: {
      name: 'Direct User',
      email: 'direct@example.com',
      password: hashed,
      role: 'student',
      studentId: 'D123'
    }});
    console.log('Created:', { id: user.id, email: user.email });
  } catch (e) {
    console.error('Create error:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
