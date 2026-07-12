const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SESSIONS = [
  { label: '2020-21', prefix: '2020', year: 4 },
  { label: '2021-22', prefix: '2021', year: 4 },
  { label: '2022-23', prefix: '2022', year: 4 },
  { label: '2023-24', prefix: '2023', year: 3 },
  { label: '2024-25', prefix: '2024', year: 2 },
  { label: '2025-26', prefix: '2025', year: 1 },
];

const FIRST_NAMES = [
  'Arif', 'Raihan', 'Fahim', 'Tanvir', 'Sabbir',
  'Mehedi', 'Shahriar', 'Rakib', 'Imran', 'Sumon',
  'Nadia', 'Sadia', 'Riya', 'Mim', 'Tania',
  'Farhan', 'Rifat', 'Sajid', 'Abir', 'Hasan',
  'Tasnim', 'Jannatul', 'Lamia', 'Anika', 'Nabila',
  'Shihab', 'Mahir', 'Tonmoy', 'Protik', 'Niloy',
  'Sumaya', 'Ishrat', 'Fahmida', 'Parisa', 'Dilruba',
  'Ashik', 'Roni', 'Sourav', 'Biplob', 'Mizan',
  'Shamima', 'Tabassum', 'Mehjabeen', 'Suraia', 'Nazmun',
  'Hridoy', 'Robin', 'Jewel', 'Pavel', 'Masum',
];

const LAST_NAMES = [
  'Ahmed', 'Hossain', 'Islam', 'Rahman', 'Khan',
  'Akter', 'Begum', 'Chowdhury', 'Miah', 'Uddin',
  'Ali', 'Kabir', 'Sarkar', 'Dey', 'Roy',
  'Mondal', 'Sheikh', 'Talukder', 'Noor', 'Bhuiyan',
];

async function main() {
  console.log('Hashing password...');
  const hashedPassword = await bcrypt.hash('Student@123', 12);

  let created = 0;
  let skipped = 0;

  for (const session of SESSIONS) {
    console.log(`\nSeeding session ${session.label} (${session.prefix})...`);

    for (let i = 1; i <= 50; i++) {
      const firstName = FIRST_NAMES[i - 1];
      const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      const num = String(i).padStart(3, '0');
      const studentId = `${session.prefix}331${num}`;
      const email = `${firstName.toLowerCase()}.${session.prefix}${num}@cse.edu`;

      try {
        await prisma.user.upsert({
          where: { studentId },
          update: {},
          create: {
            name,
            email,
            password: hashedPassword,
            roles: ['student'],
            studentId,
            program: 'Computer Science & Engineering',
            year: session.year,
            isActive: true,
            isEmailVerified: true,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    console.log(`  Done session ${session.label}`);
  }

  console.log(`\nFinished. Created/updated: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
