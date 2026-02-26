/**
 * Test script for Event Registration API
 * Run this after starting the server to verify the registration endpoints work
 * 
 * Usage: node test-event-registration.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let testEventId = '';
let userId = '';

// Helper function to log results
const log = (message, data = null) => {
  console.log('\n' + '='.repeat(60));
  console.log(message);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log('='.repeat(60));
};

// 1. Login or Register
async function loginUser() {
  try {
    log('Step 1: Attempting to login...');
    
    // Try to login first
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });
      
      authToken = response.data.token;
      userId = response.data.user.id;
      log('✅ Login successful!', { token: authToken, userId });
      return true;
    } catch (loginError) {
      // If login fails, try to register
      log('Login failed, attempting to register new user...');
      
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'student',
        registrationNumber: '2026331001',
        program: 'Computer Science',
        year: 3
      });
      
      authToken = registerResponse.data.token;
      userId = registerResponse.data.user.id;
      log('✅ Registration successful!', { token: authToken, userId });
      return true;
    }
  } catch (error) {
    log('❌ Authentication failed', error.response?.data || error.message);
    return false;
  }
}

// 2. Create a test event
async function createEvent() {
  try {
    log('Step 2: Creating test event...');
    
    const eventData = {
      title: 'Test Workshop - Event Registration',
      description: 'This is a test event to verify the registration system works correctly',
      category: 'Tech',
      venue: 'Room 101, CSE Building',
      eventDate: '2026-03-15',
      startTime: '10:00',
      endTime: '15:00',
      maxParticipants: 50,
      registrationDeadline: '2026-03-10',
      registrationFee: 0,
      organizerName: 'CSE Society',
      organizerContact: '+1234567890'
    };
    
    const response = await axios.post(`${BASE_URL}/events`, eventData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testEventId = response.data.event.id;
    log('✅ Event created successfully!', response.data.event);
    return true;
  } catch (error) {
    log('❌ Event creation failed', error.response?.data || error.message);
    return false;
  }
}

// 3. Get all events
async function getAllEvents() {
  try {
    log('Step 3: Fetching all events...');
    
    const response = await axios.get(`${BASE_URL}/events?upcoming=true`);
    
    log(`✅ Found ${response.data.events.length} events`, {
      totalEvents: response.data.events.length,
      events: response.data.events.map(e => ({
        id: e.id,
        title: e.title,
        registrations: e._count?.registrations || 0
      }))
    });
    return true;
  } catch (error) {
    log('❌ Failed to fetch events', error.response?.data || error.message);
    return false;
  }
}

// 4. Get single event details
async function getEventDetails() {
  try {
    log('Step 4: Fetching event details...');
    
    const response = await axios.get(`${BASE_URL}/events/${testEventId}`);
    
    log('✅ Event details retrieved', {
      id: response.data.event.id,
      title: response.data.event.title,
      registrations: response.data.event._count?.registrations || 0
    });
    return true;
  } catch (error) {
    log('❌ Failed to fetch event details', error.response?.data || error.message);
    return false;
  }
}

// 5. Register for event
async function registerForEvent() {
  try {
    log('Step 5: Registering for event...');
    
    const response = await axios.post(
      `${BASE_URL}/events/${testEventId}/register`,
      { remarks: 'Looking forward to this test event!' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    log('✅ Registration successful!', response.data.registration);
    return true;
  } catch (error) {
    log('❌ Registration failed', error.response?.data || error.message);
    return false;
  }
}

// 6. Try to register again (should fail)
async function tryDuplicateRegistration() {
  try {
    log('Step 6: Attempting duplicate registration (should fail)...');
    
    await axios.post(
      `${BASE_URL}/events/${testEventId}/register`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    log('❌ UNEXPECTED: Duplicate registration was allowed!');
    return false;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('Already registered')) {
      log('✅ Correctly prevented duplicate registration', error.response.data);
      return true;
    }
    log('❌ Unexpected error', error.response?.data || error.message);
    return false;
  }
}

// 7. Get my registrations
async function getMyRegistrations() {
  try {
    log('Step 7: Fetching my registrations...');
    
    const response = await axios.get(`${BASE_URL}/events/my/registrations`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    log(`✅ Found ${response.data.registrations.length} registration(s)`, {
      registrations: response.data.registrations.map(r => ({
        id: r.id,
        eventTitle: r.event.title,
        status: r.status,
        paymentStatus: r.paymentStatus
      }))
    });
    return true;
  } catch (error) {
    log('❌ Failed to fetch registrations', error.response?.data || error.message);
    return false;
  }
}

// 8. Cancel registration
async function cancelRegistration() {
  try {
    log('Step 8: Cancelling registration...');
    
    const response = await axios.delete(`${BASE_URL}/events/${testEventId}/register`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    log('✅ Registration cancelled successfully', response.data);
    return true;
  } catch (error) {
    log('❌ Failed to cancel registration', error.response?.data || error.message);
    return false;
  }
}

// 9. Verify registration was cancelled
async function verifyRegistrationCancelled() {
  try {
    log('Step 9: Verifying registration status...');
    
    const response = await axios.get(`${BASE_URL}/events/my/registrations`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const cancelledReg = response.data.registrations.find(r => r.eventId === testEventId);
    
    if (cancelledReg && cancelledReg.status === 'cancelled') {
      log('✅ Registration status correctly shows as cancelled', cancelledReg);
      return true;
    } else {
      log('❌ Registration status not updated correctly', cancelledReg);
      return false;
    }
  } catch (error) {
    log('❌ Failed to verify registration', error.response?.data || error.message);
    return false;
  }
}

// 10. Clean up - delete test event
async function cleanup() {
  try {
    log('Step 10: Cleaning up (deleting test event)...');
    
    const response = await axios.delete(`${BASE_URL}/events/${testEventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    log('✅ Test event deleted successfully', response.data);
    return true;
  } catch (error) {
    log('⚠️  Failed to delete test event', error.response?.data || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('\n🚀 Starting Event Registration API Tests...\n');
  
  let passedTests = 0;
  let totalTests = 10;
  
  // Run tests sequentially
  if (await loginUser()) passedTests++;
  if (await createEvent()) passedTests++;
  if (await getAllEvents()) passedTests++;
  if (await getEventDetails()) passedTests++;
  if (await registerForEvent()) passedTests++;
  if (await tryDuplicateRegistration()) passedTests++;
  if (await getMyRegistrations()) passedTests++;
  if (await cancelRegistration()) passedTests++;
  if (await verifyRegistrationCancelled()) passedTests++;
  if (await cleanup()) passedTests++;
  
  // Final summary
  log(`\n📊 TEST SUMMARY`, {
    passed: passedTests,
    failed: totalTests - passedTests,
    total: totalTests,
    percentage: `${((passedTests / totalTests) * 100).toFixed(1)}%`
  });
  
  if (passedTests === totalTests) {
    console.log('\n✅ ALL TESTS PASSED! Event registration system is working correctly.\n');
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please check the logs above.\n`);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    console.error('\n❌ Cannot connect to server at', BASE_URL);
    console.error('Please ensure the backend server is running:');
    console.error('  cd projectbackend');
    console.error('  npm start\n');
    return false;
  }
}

// Main execution
(async () => {
  if (await checkServer()) {
    await runTests();
  }
})();
