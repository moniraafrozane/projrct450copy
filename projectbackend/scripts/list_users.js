const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const users = await p.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true } });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error listing users:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
