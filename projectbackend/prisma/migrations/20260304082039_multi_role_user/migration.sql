-- Custom migration: merge duplicate users (same email, different roles) into
-- a single row with a roles[] array, then update all foreign keys.

-- Step 1: Add roles array column, populate from existing single role column
ALTER TABLE "users" ADD COLUMN "roles" "Role"[] DEFAULT ARRAY['student']::"Role"[];
UPDATE "users" SET "roles" = ARRAY["role"];

-- Step 2: For emails with multiple rows, merge all roles into the earliest-created row
UPDATE "users" u1
SET "roles" = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(u2."roles")
    FROM "users" u2
    WHERE u2."email" = u1."email"
  )
)
WHERE EXISTS (
  SELECT 1 FROM "users" u2
  WHERE u2."email" = u1."email" AND u2."id" != u1."id"
)
AND u1."createdAt" = (
  SELECT MIN(u2."createdAt") FROM "users" u2 WHERE u2."email" = u1."email"
);

-- Step 3: Reassign event_registrations to the surviving (keeper) row
UPDATE "event_registrations" er
SET "userId" = (
  SELECT u."id" FROM "users" u
  WHERE u."email" = (SELECT ue."email" FROM "users" ue WHERE ue."id" = er."userId")
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE er."userId" IN (
  SELECT "id" FROM "users" u
  WHERE "createdAt" > (
    SELECT MIN(u2."createdAt") FROM "users" u2 WHERE u2."email" = u."email"
  )
);

-- Remove event_registration duplicates that may appear after FK reassignment
DELETE FROM "event_registrations"
WHERE "id" NOT IN (
  SELECT MIN("id") FROM "event_registrations" GROUP BY "userId", "eventId"
);

-- Step 4: Reassign positions to the surviving row
UPDATE "positions" p
SET "userId" = (
  SELECT u."id" FROM "users" u
  WHERE u."email" = (SELECT ue."email" FROM "users" ue WHERE ue."id" = p."userId")
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE p."userId" IN (
  SELECT "id" FROM "users" u
  WHERE "createdAt" > (
    SELECT MIN(u2."createdAt") FROM "users" u2 WHERE u2."email" = u."email"
  )
);

-- Step 5: Reassign committee_members to the surviving row
UPDATE "committee_members" cm
SET "userId" = (
  SELECT u."id" FROM "users" u
  WHERE u."email" = (SELECT ue."email" FROM "users" ue WHERE ue."id" = cm."userId")
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE cm."userId" IN (
  SELECT "id" FROM "users" u
  WHERE "createdAt" > (
    SELECT MIN(u2."createdAt") FROM "users" u2 WHERE u2."email" = u."email"
  )
);

-- Step 6: Delete duplicate user rows (keep only the earliest created per email)
DELETE FROM "users"
WHERE "id" IN (
  SELECT "id" FROM "users" u
  WHERE "createdAt" > (
    SELECT MIN(u2."createdAt") FROM "users" u2 WHERE u2."email" = u."email"
  )
);

-- Step 7: Nullify duplicate studentIds so the unique constraint can be applied
UPDATE "users" u1
SET "studentId" = NULL
WHERE "studentId" IS NOT NULL
  AND "id" != (
    SELECT u2."id" FROM "users" u2
    WHERE u2."studentId" = u1."studentId"
    ORDER BY u2."createdAt" ASC
    LIMIT 1
  );

-- Step 8: Drop old composite unique indexes
DROP INDEX IF EXISTS "users_email_role_key";
DROP INDEX IF EXISTS "users_studentId_role_key";

-- Step 9: Drop the old single-role column
ALTER TABLE "users" DROP COLUMN "role";

-- Step 10: Create new unique indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_studentId_key" ON "users"("studentId");
