-- Add semester and session fields to student fee payments
ALTER TABLE "student_fee_payments"
ADD COLUMN "semester" TEXT,
ADD COLUMN "session" TEXT;