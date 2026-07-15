const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Development-only seed endpoint. Do NOT enable in production.
router.post('/seed-vouchers', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not allowed in production' });
    }

    const { eventId, count = 3 } = req.body || {};
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Prefer a society user as creator, fall back to any user
    let user = await prisma.user.findFirst({ where: { roles: { has: 'society' } } });
    if (!user) user = await prisma.user.findFirst();
    if (!user) return res.status(500).json({ success: false, message: 'No user found to assign as creator' });

    const created = [];
    for (let i = 0; i < Number(count); i++) {
      const title = i === 0 ? 'food' : `sample expense ${i + 1}`;
      const receiptFileName = i === 0 ? 'tt1_(1)_(1)_(1).jpg' : `sample-${i + 1}.jpg`;
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/receipts/${receiptFileName}`;

      const v = await prisma.voucher.create({
        data: {
          title,
          description: i === 0 ? 'kjgdw' : `Auto-seeded expense ${i + 1}`,
          amount: i === 0 ? 1000 : (1000 + i * 500),
          status: 'draft',
          receiptFileUrl: fileUrl,
          receiptFileName,
          receiptMimeType: 'image/jpeg',
          eventId: eventId,
          createdById: user.id,
        },
      });

      created.push(v);
    }

    return res.json({ success: true, createdCount: created.length, vouchers: created });
  } catch (error) {
    console.error('Seed vouchers error:', error);
    return res.status(500).json({ success: false, message: 'Error seeding vouchers', error: error.message });
  }
});

module.exports = router;
