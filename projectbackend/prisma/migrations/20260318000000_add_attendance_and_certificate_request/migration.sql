-- CreateEnum
CREATE TYPE "CertificateRequestStatus" AS ENUM ('not_requested', 'pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "RegistrationLogEventType" ADD VALUE IF NOT EXISTS 'attendance_marked';
ALTER TYPE "RegistrationLogEventType" ADD VALUE IF NOT EXISTS 'certificate_requested';

-- AlterTable
ALTER TABLE "event_registrations"
ADD COLUMN "attended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "attendedAt" TIMESTAMP(3),
ADD COLUMN "certificateRequestStatus" "CertificateRequestStatus" NOT NULL DEFAULT 'not_requested',
ADD COLUMN "certificateRequestedAt" TIMESTAMP(3);
