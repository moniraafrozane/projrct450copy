require('dotenv').config();
const prisma = require('./config/prisma');

async function checkApplication() {
  try {
    await prisma.$connect();
    console.log('✓ Connected to database\n');

    const appId = '923ca7a4-b245-4d05-a8b9-35c1fcb8bb9f';
    
    // Check if application exists
    const app = await prisma.societyApplication.findUnique({
      where: { id: appId }
    });

    if (!app) {
      console.log('✗ Application not found');
      return;
    }

    console.log('✓ Application found\n');
    console.log('Details:');
    console.log(`  ID: ${app.id}`);
    console.log(`  Type: ${app.type}`);
    console.log(`  Status: ${app.status}`);
    console.log(`  Subject: ${app.subject}`);
    console.log(`  Created by: ${app.createdByName} (ID: ${app.createdById})`);
    console.log(`  Admin notes: ${app.adminNotes || '(none)'}\n`);

    const canApprove = app.status === 'submitted' || app.status === 'under_review';
    console.log(`Can approve/reject? ${canApprove ? '✓ YES' : '✗ NO'}`);
    
    if (!canApprove) {
      console.log(`  (Only applications with status "submitted" or "under_review" can be approved/rejected)`);
    }

    // Check if the creator user exists and is active
    const creator = await prisma.user.findUnique({
      where: { id: app.createdById }
    });

    if (creator) {
      console.log(`\nCreator details:`);
      console.log(`  Name: ${creator.name}`);
      console.log(`  Email: ${creator.email}`);
      console.log(`  Active: ${creator.isActive ? '✓' : '✗'}`);
      console.log(`  Roles: ${creator.roles.join(', ')}`);
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkApplication();
