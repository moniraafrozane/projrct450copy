const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getFirstStudent() {
  try {
    const student = await prisma.user.findFirst({
      where: { role: 'student' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (student) {
      console.log('\n=== Sample User for Testing ===\n');
      console.log(`Name: ${student.name}`);
      console.log(`Email: ${student.email}`);
      console.log(`Role: ${student.role}`);
      console.log(`\n✨ User ID: ${student.id}`);
      console.log('\n📋 Copy the User ID above to test position assignment!\n');
    } else {
      console.log('No student users found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getFirstStudent();
