const { PrismaClient } = require('@prisma/client');

(async () => {
  const p = new PrismaClient();
  try {
    const apps = await p.societyApplication.findMany({
      select: {
        id: true,
        type: true,
        subject: true,
        status: true,
        createdByName: true
      }
    });
    console.log('Total applications:', apps.length);
    console.log(JSON.stringify(apps, null, 2));
  } finally {
    await p.$disconnect();
  }
})();
