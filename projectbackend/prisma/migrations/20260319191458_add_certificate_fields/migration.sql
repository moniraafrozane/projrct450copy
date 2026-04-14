/*
  Warnings:

  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `amount` on table `vouchers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `receiptFileUrl` on table `vouchers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `receiptFileName` on table `vouchers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `receiptMimeType` on table `vouchers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `eventId` on table `vouchers` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_eventId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_receiptId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_notification_preferences" DROP CONSTRAINT "user_notification_preferences_userId_fkey";

-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN     "certificateApprovedAt" TIMESTAMP(3),
ADD COLUMN     "certificateFileUrl" TEXT;

-- AlterTable
ALTER TABLE "vouchers" ALTER COLUMN "amount" SET NOT NULL,
ALTER COLUMN "receiptFileUrl" SET NOT NULL,
ALTER COLUMN "receiptFileName" SET NOT NULL,
ALTER COLUMN "receiptMimeType" SET NOT NULL,
ALTER COLUMN "eventId" SET NOT NULL;

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "user_notification_preferences";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "NotificationType";
