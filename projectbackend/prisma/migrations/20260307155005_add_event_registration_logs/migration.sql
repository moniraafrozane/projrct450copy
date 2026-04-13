-- CreateEnum
CREATE TYPE "RegistrationLogEventType" AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'comment_added', 'certificate_uploaded', 'certificate_ready', 'email_sent', 'receipt_generated');

-- CreateEnum
CREATE TYPE "RegistrationLogActorRole" AS ENUM ('student', 'admin', 'system');

-- CreateTable
CREATE TABLE "event_registration_logs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventType" "RegistrationLogEventType" NOT NULL,
    "actorRole" "RegistrationLogActorRole" NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "actorName" TEXT,
    "message" TEXT NOT NULL,
    "previousStatus" "RegistrationStatus",
    "nextStatus" "RegistrationStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_registration_logs_registrationId_createdAt_idx" ON "event_registration_logs"("registrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "event_registration_logs" ADD CONSTRAINT "event_registration_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
