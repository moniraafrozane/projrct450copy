require('dotenv').config();
const prisma = require('./config/prisma');
const axios = require('axios');

async function testApproveApplication() {
  try {
    // Connect to Prisma
    await prisma.$connect();
    console.log('Connected to database');

    // Get the application
    const appId = '923ca7a4-b245-4d05-a8b9-35c1fcb8bb9f';
    const app = await prisma.societyApplication.findUnique({
      where: { id: appId }
    });

    if (!app) {
      console.log('Application not found');
      return;
    }

    console.log('Application found:');
    console.log('  ID:', app.id);
    console.log('  Status:', app.status);
    console.log('  Type:', app.type);
    console.log('  Created by:', app.createdByName);
    console.log('  Can approve?', app.status === 'submitted' || app.status === 'under_review' ? 'YES' : 'NO');

    // Get a test admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        roles: {
          has: 'admin'
        }
      }
    });

    if (!adminUser) {
      console.log('No admin user found');
      return;
    }

    console.log('\nAdmin user found:', adminUser.email);

    // Test the approve endpoint
    console.log('\nAttempting to approve application via API...');
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.put(
      `${baseUrl}/api/applications/${appId}/approve`,
      { adminNotes: 'Test approval from script' },
      {
        headers: {
          'Authorization': `Bearer ${adminUser.id}` // This won't work - need valid JWT
        }
      }
    );

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testApproveApplication();
