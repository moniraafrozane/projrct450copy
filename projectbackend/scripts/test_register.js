(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'Password123!', role: 'student', studentId: 'S12345' })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Request error:', e.message);
  }
})();
