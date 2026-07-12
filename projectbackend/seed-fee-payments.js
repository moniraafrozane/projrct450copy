/**
 * Seeds fee payment records for the 300 dummy students only
 * (studentId format: 20xx331001 – 20xx331050, batches 2020-2025).
 * Safe to re-run — skips any semester a student already has a payment for.
 */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const SEMESTER_CODES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

// Academic session label for a given batch year and semester index (1-based)
function sessionLabel(batchYear, semIndex) {
  const offset = Math.floor((semIndex - 1) / 2);
  const y = batchYear + offset;
  return `${y}-${String(y + 1).slice(-2)}`;
}

// Realistic payment date: February for 1st-semester, August for 2nd-semester of each year
function paymentDate(batchYear, semIndex) {
  const offset = Math.floor((semIndex - 1) / 2);
  const y = batchYear + offset;
  const month = semIndex % 2 === 1 ? 2 : 8;
  const day = 1 + Math.floor(Math.random() * 20);
  return new Date(y, month - 1, day);
}

async function main() {
  // Only the 300 seeded students (20xx331001-050 for xx = 20..25)
  const students = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { has: 'student' },
      studentId: { in: generateSeededIds() },
    },
    select: { id: true, name: true, studentId: true, year: true },
    orderBy: { studentId: 'asc' },
  });

  console.log(`Found ${students.length} seeded students.`);

  // Build set of already-existing payments to skip duplicates
  const existing = await prisma.studentFeePayment.findMany({
    where: { studentId: { in: students.map(s => s.id) } },
    select: { studentId: true, semester: true },
  });
  const existingSet = new Set(existing.map(p => `${p.studentId}:${p.semester}`));
  console.log(`Skipping ${existingSet.size} already-existing payment records.`);

  const toCreate = [];

  for (const student of students) {
    const batchYear = parseInt(student.studentId.slice(0, 4), 10);
    // Semesters paid = year in programme × 2 (max 8)
    const maxPaid = Math.min((student.year || 1) * 2, 8);
    // Add variety: ~20% of students are one semester behind
    const paidCount = Math.random() < 0.2 ? Math.max(maxPaid - 1, 0) : maxPaid;

    for (let i = 1; i <= paidCount; i++) {
      const semCode = SEMESTER_CODES[i - 1];
      const key = `${student.id}:${semCode}`;
      if (existingSet.has(key)) continue;
      existingSet.add(key);

      toCreate.push({
        studentId: student.id,
        reference: `SEED-${student.studentId}-${semCode}-${randomUUID().slice(0, 6).toUpperCase()}`,
        paymentDate: paymentDate(batchYear, i),
        amount: 500,
        semester: semCode,
        session: sessionLabel(batchYear, i),
        status: 'paid',
        notes: 'Demo payment record',
      });
    }
  }

  console.log(`Creating ${toCreate.length} new payment records...`);
  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    await prisma.studentFeePayment.createMany({ data: toCreate.slice(i, i + BATCH) });
    done += Math.min(BATCH, toCreate.length - i);
    process.stdout.write(`\r  ${done} / ${toCreate.length}`);
  }
  console.log(`\nDone. ${done} records created.`);
}

/** Returns the 300 studentId strings (20xx331001–050, xx = 20-25) */
function generateSeededIds() {
  const ids = [];
  for (const yr of [2020, 2021, 2022, 2023, 2024, 2025]) {
    for (let i = 1; i <= 50; i++) {
      ids.push(`${yr}331${String(i).padStart(3, '0')}`);
    }
  }
  return ids;
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
