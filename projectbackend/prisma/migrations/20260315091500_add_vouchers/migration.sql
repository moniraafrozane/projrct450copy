-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'draft',
    "receiptFileUrl" TEXT NOT NULL,
    "receiptFileName" TEXT NOT NULL,
    "receiptMimeType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "budgetApplicationId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminDecisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vouchers_status_createdAt_idx" ON "vouchers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "vouchers_eventId_status_idx" ON "vouchers"("eventId", "status");

-- CreateIndex
CREATE INDEX "vouchers_createdById_status_idx" ON "vouchers"("createdById", "status");

-- CreateIndex
CREATE INDEX "vouchers_budgetApplicationId_idx" ON "vouchers"("budgetApplicationId");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_budgetApplicationId_fkey" FOREIGN KEY ("budgetApplicationId") REFERENCES "society_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
