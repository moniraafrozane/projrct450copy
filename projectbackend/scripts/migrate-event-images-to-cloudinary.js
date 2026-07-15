require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const prisma = require('../config/prisma');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadsDir = path.join(__dirname, '../uploads/images');

async function migrate() {
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { bannerImage: { contains: 'localhost' } },
        { bannerImage: { contains: '192.168.' } },
        { bannerImage: { contains: '127.0.0.1' } },
        { bannerImage: { contains: '10.0.' } }
      ]
    },
    select: { id: true, title: true, bannerImage: true }
  });

  console.log(`Found ${events.length} events with local image URLs to migrate.\n`);

  let migrated = 0;
  let failed = 0;

  for (const event of events) {
    const filename = decodeURIComponent(event.bannerImage.split('/uploads/images/')[1] || '');
    const localPath = path.join(uploadsDir, filename);

    if (!filename || !fs.existsSync(localPath)) {
      console.log(`[SKIP] ${event.title}: local file not found (${filename})`);
      failed++;
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(localPath, {
        folder: 'cse-society/event-images',
        resource_type: 'image'
      });

      await prisma.event.update({
        where: { id: event.id },
        data: { bannerImage: result.secure_url }
      });

      console.log(`[OK] ${event.title} -> ${result.secure_url}`);
      migrated++;
    } catch (err) {
      console.log(`[FAIL] ${event.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed/Skipped: ${failed}`);
  await prisma.$disconnect();
}

migrate().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
