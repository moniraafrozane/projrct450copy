-- Add forwardedToAdmin, forwardedAt, forwardedById to student_fee_receipts
ALTER TABLE "student_fee_receipts"
ADD COLUMN "forwarded_to_admin" boolean DEFAULT false,
ADD COLUMN "forwarded_at" timestamptz NULL,
ADD COLUMN "forwarded_by_id" text NULL;

-- Add foreign key constraint for forwarded_by_id referencing users(id)
ALTER TABLE "student_fee_receipts"
ADD CONSTRAINT fk_forwarded_by FOREIGN KEY ("forwarded_by_id") REFERENCES "users"(id) ON DELETE SET NULL;