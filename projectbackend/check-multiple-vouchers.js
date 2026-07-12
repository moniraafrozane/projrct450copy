const prisma = require('./config/prisma');

(async () => {
  try {
    const eventId = 'f94aaa51-5bea-4a1b-a6f1-037114f297e1';
    const vouchers = await prisma.voucher.findMany({
      where: { eventId },
      select: { id: true, title: true, amount: true, status: true, createdAt: true }
    });

    console.log('\n=== Vouchers for Event ===');
    console.log(`Event ID: ${eventId}`);
    console.log(`Total Vouchers: ${vouchers.length}\n`);

    vouchers.forEach((v, i) => {
      console.log(`${i + 1}. Title: "${v.title}"`);
      console.log(`   Amount: ${v.amount} BDT`);
      console.log(`   Status: ${v.status}`);
      console.log(`   Created: ${v.createdAt}\n`);
    });

    console.log(`✓ Successfully created ${vouchers.length} vouchers for the same event!`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
