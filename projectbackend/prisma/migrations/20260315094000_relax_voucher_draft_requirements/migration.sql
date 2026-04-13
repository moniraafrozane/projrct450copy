-- Relax voucher draft requirements: make receipt and event fields nullable
-- These were applied directly to the database

ALTER TABLE "vouchers" ALTER COLUMN "amount" DROP NOT NULL;
ALTER TABLE "vouchers" ALTER COLUMN "receiptFileUrl" DROP NOT NULL;
ALTER TABLE "vouchers" ALTER COLUMN "receiptFileName" DROP NOT NULL;
ALTER TABLE "vouchers" ALTER COLUMN "receiptMimeType" DROP NOT NULL;
ALTER TABLE "vouchers" ALTER COLUMN "eventId" DROP NOT NULL;
