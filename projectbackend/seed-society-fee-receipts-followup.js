/**
 * Follow-up to seed-society-fee-receipts.js.
 *
 * The first pass mostly attached "accepted" receipts to semesters that were
 * already marked paid by the older seed-fee-payments.js run, so the review
 * queue ended up almost entirely "accepted" with very little pending/rejected
 * variety. This pass adds one more receipt per student for the semester
 * right after their last *paid* semester (their "next" submission), using a
 * genuine random outcome (accepted/pending/rejected) so the Society fee
 * receipts queue has a realistic mix to review.
 *
 * Does NOT create new students. Safe to re-run: skips a student if that next
 * semester slot already has a payment record.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const BACKEND_ORIGIN = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const RECEIPTS_DIR = path.join(__dirname, 'uploads/receipts');
const SEMESTER_CODES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
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
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
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
    for (let i = 1; i <= 50; i++) ids.push(`${yr}331${String(i).padStart(3, '0')}`);
  }
  return ids;
}

function loadReceiptFilePool() {
  const files = fs.readdirSync(RECEIPTS_DIR).filter((f) => /\.(png|jpe?g|pdf)$/i.test(f));
  if (!files.length) throw new Error(`No usable receipt files found in ${RECEIPTS_DIR}`);
  return files;
}

// 40% accepted, 40% pending, 20% rejected - deliberately heavier on
// pending/rejected than the first pass to give the review queue real variety.
function pickOutcome() {
  const r = Math.random();
  if (r < 0.4) return 'accepted';
  if (r < 0.8) return 'pending';
  return 'rejected';
}

async function main() {
  const ids = generateSeededIds();

  const students = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'student' }, studentId: { in: ids } },
    select: { id: true, studentId: true },
    orderBy: { studentId: 'asc' },
  });
  console.log(`Found ${students.length} seeded dummy students.`);

  const reviewer = await prisma.user.findFirst({
    where: { isActive: true, roles: { has: 'admin' } },
    select: { id: true },
  });
  if (!reviewer) throw new Error('No active admin user found to act as receipt reviewer.');

  const filePool = loadReceiptFilePool();

  const existingPayments = await prisma.studentFeePayment.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, semester: true, status: true },
  });
  const paymentMap = new Map(); // studentId -> Set(semester)
  const maxPaidIndexMap = new Map(); // studentId -> highest paid semester index (0 if none)
  for (const payment of existingPayments) {
    if (!paymentMap.has(payment.studentId)) paymentMap.set(payment.studentId, new Set());
    paymentMap.get(payment.studentId).add(payment.semester);

    if (payment.status === 'paid') {
      const idx = SEMESTER_CODES.indexOf(payment.semester) + 1;
      maxPaidIndexMap.set(payment.studentId, Math.max(maxPaidIndexMap.get(payment.studentId) || 0, idx));
    }
  }

  let created = 0;
  let skipped = 0;
  const counts = { accepted: 0, pending: 0, rejected: 0 };

  for (const student of students) {
    const batchYear = parseInt(student.studentId.slice(0, 4), 10);
    const maxPaidIndex = maxPaidIndexMap.get(student.id) || 0;
    const nextIndex = maxPaidIndex + 1;

    if (nextIndex > 8) {
      skipped++; // already paid through 8th semester
      continue;
    }

    const nextSemCode = SEMESTER_CODES[nextIndex - 1];
    const existingSemesters = paymentMap.get(student.id) || new Set();
    if (existingSemesters.has(nextSemCode)) {
      skipped++; // slot already taken (e.g. by the first seed pass)
      continue;
    }

    const outcome = pickOutcome();
    const session = sessionLabel(batchYear, nextIndex);
    const file = pick(filePool);
    const ext = path.extname(file).toLowerCase();
    const fileUrl = `${BACKEND_ORIGIN}/uploads/receipts/${file}`;
    const fileName = `bank_receipt_${student.studentId}_${nextSemCode}${ext}`;
    const mimeType = mimeTypeForExt(ext);
    const amount = pick(AMOUNT_OPTIONS);
    const paymentDate = recentDate(30);
    const reference = `RCPT-${student.studentId}-${nextSemCode}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const notes = `Tuition fee payment for ${session} session, ${nextSemCode} semester.`;

    await prisma.$transaction(async (tx) => {
      const payment = await tx.studentFeePayment.create({
        data: {
          studentId: student.id,
          reference,
          paymentDate,
          amount,
          semester: nextSemCode,
          session,
          notes,
          status: outcome === 'accepted' ? 'paid' : 'pending',
          ...(outcome === 'accepted' ? { verifiedById: reviewer.id, verifiedAt: new Date() } : {}),
        },
      });

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

  console.log(`Created ${created} additional receipts (accepted: ${counts.accepted}, pending: ${counts.pending}, rejected: ${counts.rejected}).`);
  console.log(`Skipped ${skipped} students (already fully paid through 8th, or slot already taken).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
