/**
 * Seeds realistic Society Fee *receipts* (paid + pending/unpaid) for the 300
 * existing dummy students (studentId 20xx331001-050, batches 2020-2025).
 * Does NOT create any new student accounts.
 *
 * For each student's current academic semester (per the official batch-year
 * mapping also used in studentAffairsController.js), this creates one
 * StudentFeeReceipt (linked to a StudentFeePayment) so the "Society fee
 * receipts" queue on /society/society-fee has realistic data to review:
 *   - ~55% accepted (already paid & reviewed)
 *   - ~30% pending (submitted, awaiting review - shows as "unpaid"/outstanding)
 *   - ~15% rejected (submitted, reviewer sent it back)
 *
 * Receipt files point at real files already present in uploads/receipts so
 * "View receipt" links work. Safe to re-run: skips any student that already
 * has a receipt for their current semester.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const BACKEND_ORIGIN = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const RECEIPTS_DIR = path.join(__dirname, 'uploads/receipts');

const SEMESTER_CODES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

// Must stay in sync with BATCH_YEAR_TO_CURRENT_SEMESTER in controllers/studentAffairsController.js
const BATCH_YEAR_TO_CURRENT_SEMESTER = {
  '2020': '8th',
  '2021': '7th',
  '2022': '6th',
  '2023': '4th',
  '2024': '3rd',
  '2025': '1st',
};

const AMOUNT_OPTIONS = [500, 550, 600, 650];

function sessionLabel(batchYear, semIndex) {
  const offset = Math.floor((semIndex - 1) / 2);
  const y = batchYear + offset;
  return `${y}-${String(y + 1).slice(-2)}`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function recentDate(maxDaysAgo) {
  const daysAgo = Math.floor(Math.random() * maxDaysAgo);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function mimeTypeForExt(ext) {
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function generateSeededIds() {
  const ids = [];
  for (const yr of [2020, 2021, 2022, 2023, 2024, 2025]) {
    for (let i = 1; i <= 50; i++) {
      ids.push(`${yr}331${String(i).padStart(3, '0')}`);
    }
  }
  return ids;
}

function loadReceiptFilePool() {
  const files = fs.readdirSync(RECEIPTS_DIR).filter((f) => /\.(png|jpe?g|pdf)$/i.test(f));
  if (!files.length) {
    throw new Error(`No usable receipt files found in ${RECEIPTS_DIR}`);
  }
  return files;
}

function pickOutcome() {
  const r = Math.random();
  if (r < 0.55) return 'accepted';
  if (r < 0.85) return 'pending';
  return 'rejected';
}

async function main() {
  const ids = generateSeededIds();

  const students = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { has: 'student' },
      studentId: { in: ids },
    },
    select: { id: true, name: true, studentId: true },
    orderBy: { studentId: 'asc' },
  });
  console.log(`Found ${students.length} seeded dummy students.`);

  const reviewer = await prisma.user.findFirst({
    where: { isActive: true, roles: { has: 'admin' } },
    select: { id: true },
  });
  if (!reviewer) {
    throw new Error('No active admin user found to act as receipt reviewer.');
  }

  const filePool = loadReceiptFilePool();

  const existingPayments = await prisma.studentFeePayment.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    select: { id: true, studentId: true, semester: true, status: true, receipt: { select: { id: true } } },
  });
  const paymentMap = new Map(); // studentId -> Map(semester -> payment)
  for (const payment of existingPayments) {
    if (!paymentMap.has(payment.studentId)) paymentMap.set(payment.studentId, new Map());
    paymentMap.get(payment.studentId).set(payment.semester, payment);
  }

  let created = 0;
  let skipped = 0;
  const counts = { accepted: 0, pending: 0, rejected: 0 };

  for (const student of students) {
    const batchYear = parseInt(student.studentId.slice(0, 4), 10);
    const currentSemCode = BATCH_YEAR_TO_CURRENT_SEMESTER[String(batchYear)];
    if (!currentSemCode) {
      skipped++;
      continue;
    }

    const semIndex = SEMESTER_CODES.indexOf(currentSemCode) + 1;
    const session = sessionLabel(batchYear, semIndex);
    const existingPayment = paymentMap.get(student.id)?.get(currentSemCode);

    if (existingPayment?.receipt) {
      skipped++;
      continue;
    }

    const file = pick(filePool);
    const ext = path.extname(file).toLowerCase();
    const fileUrl = `${BACKEND_ORIGIN}/uploads/receipts/${file}`;
    const fileName = `bank_receipt_${student.studentId}${ext}`;
    const mimeType = mimeTypeForExt(ext);
    const amount = pick(AMOUNT_OPTIONS);
    const paymentDate = recentDate(45);
    const reference = `RCPT-${student.studentId}-${currentSemCode}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const notes = `Tuition fee payment for ${session} session, ${currentSemCode} semester.`;

    const outcome = existingPayment ? (existingPayment.status === 'paid' ? 'accepted' : pickOutcome()) : pickOutcome();

    await prisma.$transaction(async (tx) => {
      let payment = existingPayment;

      if (!payment) {
        payment = await tx.studentFeePayment.create({
          data: {
            studentId: student.id,
            reference,
            paymentDate,
            amount,
            semester: currentSemCode,
            session,
            notes,
            status: outcome === 'accepted' ? 'paid' : 'pending',
            ...(outcome === 'accepted'
              ? { verifiedById: reviewer.id, verifiedAt: new Date() }
              : {}),
          },
        });
      } else if (outcome === 'accepted' && payment.status !== 'paid') {
        payment = await tx.studentFeePayment.update({
          where: { id: payment.id },
          data: { status: 'paid', verifiedById: reviewer.id, verifiedAt: new Date() },
        });
      }

      await tx.studentFeeReceipt.create({
        data: {
          paymentId: payment.id,
          studentId: student.id,
          fileUrl,
          fileName,
          mimeType,
          status: outcome,
          ...(outcome !== 'pending'
            ? {
                reviewedById: reviewer.id,
                reviewedAt: new Date(),
                adminNote: outcome === 'rejected' ? 'Receipt unclear / amount mismatch. Please resubmit.' : null,
              }
            : {}),
        },
      });
    });

    counts[outcome]++;
    created++;
  }

  console.log(`Created ${created} receipts (accepted: ${counts.accepted}, pending: ${counts.pending}, rejected: ${counts.rejected}).`);
  console.log(`Skipped ${skipped} students (already had a receipt for their current semester, or unmapped batch year).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
