CREATE TABLE "analytics_reports" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reportYear" INTEGER NOT NULL,
  "notes" TEXT,
  "metricKeys" JSONB NOT NULL,
  "metricValues" JSONB NOT NULL,
  "filters" JSONB,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_reports_reportYear_createdAt_idx" ON "analytics_reports"("reportYear", "createdAt");
CREATE INDEX "analytics_reports_createdById_createdAt_idx" ON "analytics_reports"("createdById", "createdAt");