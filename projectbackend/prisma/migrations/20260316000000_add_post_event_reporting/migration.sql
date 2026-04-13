-- CreateEnum
CREATE TYPE "EventReportStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'returned');

-- CreateTable
CREATE TABLE "event_reports" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendanceRecord" JSONB,
    "eventInsights" JSONB,
    "expenseNotes" TEXT,
    "budgetApplicationId" TEXT,
    "status" "EventReportStatus" NOT NULL DEFAULT 'draft',
    "adminNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_report_media" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_report_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_reports_eventId_status_idx" ON "event_reports"("eventId", "status");

-- CreateIndex
CREATE INDEX "event_reports_createdById_status_idx" ON "event_reports"("createdById", "status");

-- CreateIndex
CREATE INDEX "event_reports_status_createdAt_idx" ON "event_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "event_report_media_reportId_idx" ON "event_report_media"("reportId");

-- AddForeignKey
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_budgetApplicationId_fkey" FOREIGN KEY ("budgetApplicationId") REFERENCES "society_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_report_media" ADD CONSTRAINT "event_report_media_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "event_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
