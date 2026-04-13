-- CreateEnum
CREATE TYPE "StudentFeePaymentStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "StudentFeeReceiptStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "student_fee_payments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "StudentFeePaymentStatus" NOT NULL DEFAULT 'pending',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_receipts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "StudentFeeReceiptStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_fee_payments_studentId_status_idx" ON "student_fee_payments"("studentId", "status");

-- CreateIndex
CREATE INDEX "student_fee_payments_createdAt_idx" ON "student_fee_payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_receipts_paymentId_key" ON "student_fee_receipts"("paymentId");

-- CreateIndex
CREATE INDEX "student_fee_receipts_studentId_status_idx" ON "student_fee_receipts"("studentId", "status");

-- CreateIndex
CREATE INDEX "student_fee_receipts_status_createdAt_idx" ON "student_fee_receipts"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "student_fee_payments" ADD CONSTRAINT "student_fee_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_payments" ADD CONSTRAINT "student_fee_payments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_receipts" ADD CONSTRAINT "student_fee_receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "student_fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_receipts" ADD CONSTRAINT "student_fee_receipts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_receipts" ADD CONSTRAINT "student_fee_receipts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
