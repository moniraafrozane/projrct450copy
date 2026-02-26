const axios = require('axios');

async function testLogin() {
  try {
    // Test student login
    console.log('Testing student login...');
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'ane@gmail.com',
      password: 'test123', // You'll need to use the correct password
      role: 'student'
    });
    
    console.log('Login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
