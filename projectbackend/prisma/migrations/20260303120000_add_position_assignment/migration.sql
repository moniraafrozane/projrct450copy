-- CreateEnum
CREATE TYPE "Position" AS ENUM ('vice_president', 'general_secretary', 'event_cultural_secretary', 'sport_secretary', 'publication_secretary', 'assistant_event_cultural_secretary', 'executive_member');

-- CreateTable
CREATE TABLE "society_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "societyName" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "society_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "society_positions_userId_key" ON "society_positions"("userId");

-- AddForeignKey
ALTER TABLE "society_positions" ADD CONSTRAINT "society_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
