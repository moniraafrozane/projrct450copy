/*
  Warnings:

  - You are about to drop the column `registrationNo` on the `event_registrations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "event_registrations" DROP COLUMN "registrationNo",
ADD COLUMN     "registrationNumber" TEXT;
