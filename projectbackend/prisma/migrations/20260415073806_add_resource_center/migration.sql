-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('document', 'policy_link', 'image', 'video', 'banner', 'logo', 'report');

-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('society_only');

-- CreateTable
CREATE TABLE "resource_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResourceType" NOT NULL,
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'society_only',
    "linkUrl" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_items_type_createdAt_idx" ON "resource_items"("type", "createdAt");

-- CreateIndex
CREATE INDEX "resource_items_createdById_createdAt_idx" ON "resource_items"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "resource_items_isActive_createdAt_idx" ON "resource_items"("isActive", "createdAt");

-- AddForeignKey
ALTER TABLE "resource_items" ADD CONSTRAINT "resource_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
