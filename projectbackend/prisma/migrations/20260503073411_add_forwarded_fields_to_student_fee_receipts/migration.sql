/*
  Warnings:

  - You are about to drop the column `forwarded_at` on the `student_fee_receipts` table. All the data in the column will be lost.
  - You are about to drop the column `forwarded_by_id` on the `student_fee_receipts` table. All the data in the column will be lost.
  - You are about to drop the column `forwarded_to_admin` on the `student_fee_receipts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "student_fee_receipts" DROP CONSTRAINT "fk_forwarded_by";

-- AlterTable
ALTER TABLE "student_fee_receipts" DROP COLUMN "forwarded_at",
DROP COLUMN "forwarded_by_id",
DROP COLUMN "forwarded_to_admin",
ADD COLUMN     "forwardedAt" TIMESTAMP(3),
ADD COLUMN     "forwardedById" TEXT,
ADD COLUMN     "forwardedToAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "student_fee_receipts" ADD CONSTRAINT "student_fee_receipts_forwardedById_fkey" FOREIGN KEY ("forwardedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
