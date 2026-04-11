// Test dual-role registration: same email/studentId across student and society roles
(async () => {
  const testEmail = `test.dualrole+${Date.now()}@example.com`;
  const testStudentId = `2020331${Math.floor(Math.random() * 1000)}`;
  
  console.log('\n=== Testing Dual-Role Registration ===');
  console.log(`Email: ${testEmail}`);
  console.log(`Student ID: ${testStudentId}\n`);
  
  try {
    // Step 1: Register as student
    console.log('1️⃣ Registering as STUDENT...');
    const studentRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: testEmail,
        password: 'Password123!',
        role: 'student',
        studentId: testStudentId,
        program: 'Computer Science',
        year: 3
      })
    });
    
    const studentData = await studentRes.json();
    console.log(`Status: ${studentRes.status}`);
    console.log(`Success: ${studentData.success}`);
    console.log(`Message: ${studentData.message || 'OK'}`);
    console.log(`User ID: ${studentData.user?.id}`);
    console.log(`Role: ${studentData.user?.role}\n`);
    
    if (!studentData.success) {
      console.error('❌ Student registration failed:', studentData.message);
      return;
    }
    
    // Step 2: Register same person as society member
    console.log('2️⃣ Registering SAME person as SOCIETY MEMBER...');
    const societyRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: testEmail,
        password: 'Password123!',
        role: 'society',
        studentId: testStudentId,
        societyRole: 'President',
        year: 3
      })
    });
    
    const societyData = await societyRes.json();
    console.log(`Status: ${societyRes.status}`);
    console.log(`Success: ${societyData.success}`);
    console.log(`Message: ${societyData.message || 'OK'}`);
    console.log(`User ID: ${societyData.user?.id}`);
    console.log(`Role: ${societyData.user?.role}\n`);
    
    if (!societyData.success) {
      console.error('❌ Society registration failed:', societyData.message);
      return;
    }
    
    // Step 3: Verify both accounts exist
    console.log('3️⃣ Verifying BOTH accounts exist...');
    
    // Login as student
    const studentLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        role: 'student'
      })
    });
    const studentLogin = await studentLoginRes.json();
    console.log(`Student login: ${studentLogin.success ? '✅' : '❌'} (${studentLogin.user?.role})`);
    
    // Login as society
    const societyLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        role: 'society'
      })
    });
    const societyLogin = await societyLoginRes.json();
    console.log(`Society login: ${societyLogin.success ? '✅' : '❌'} (${societyLogin.user?.role})`);
    
    if (studentLogin.success && societyLogin.success) {
      console.log('\n✅ SUCCESS! Same person registered in both roles with same email & student ID\n');
    } else {
      console.log('\n❌ FAILED to verify dual accounts\n');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
})();
