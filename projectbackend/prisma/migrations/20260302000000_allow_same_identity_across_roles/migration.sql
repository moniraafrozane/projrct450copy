-- Allow same person to register in multiple roles (student/society/admin)
-- while preserving uniqueness within each role.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_studentId_key";

DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_studentId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_role_key" ON "users"("email", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "users_studentId_role_key" ON "users"("studentId", "role");
