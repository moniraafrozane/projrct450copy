// Script to initialize positions and test assignment
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// You'll need to replace this with a valid admin token
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE';

async function testPositionAssignment() {
  try {
    console.log('\n=== Testing Position Assignment ===\n');
    
    // Step 1: Initialize positions
    console.log('1. Initializing positions...');
    try {
      const initResponse = await axios.post(
        `${API_URL}/positions/init`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`
          }
        }
      );
      console.log('✅ Positions initialized:', initResponse.data.message);
    } catch (err) {
      console.log('⚠️ Positions may already exist:', err.response?.data?.message || err.message);
    }

    // Step 2: Get all positions
    console.log('\n2. Fetching all positions...');
    const positionsResponse = await axios.get(`${API_URL}/positions`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });
    console.log('✅ Found positions:', positionsResponse.data.count);
    console.log(positionsResponse.data.positions.map(p => `  - ${p.title} (ID: ${p.id})`).join('\n'));

    // Step 3: Instructions for testing
    console.log('\n3. To test assignment:');
    console.log('   - Go to the admin dashboard');
    console.log('   - Click "Assign position" button');
    console.log('   - Select a position');
    console.log('   - Enter a user ID (you can get one from list-user-ids.js)');
    console.log('   - Click "Assign Position"');

    console.log('\n📝 Example User IDs:');
    console.log('   - Get user IDs by running: node list-user-ids.js');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️ Backend server is not running!');
      console.log('   Start it with: cd projectbackend && node server.js');
    }
    
    if (error.response?.status === 401) {
      console.log('\n⚠️ Authentication required!');
      console.log('   You need to:');
      console.log('   1. Login as admin');
      console.log('   2. Get your token from browser localStorage');
      console.log('   3. Replace ADMIN_TOKEN in this script');
    }
  }
}

testPositionAssignment();
