-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('confirmed', 'waitlisted', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'refunded');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "venue" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxParticipants" INTEGER,
    "registrationDeadline" TIMESTAMP(3),
    "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organizerId" TEXT NOT NULL,
    "organizerName" TEXT NOT NULL,
    "organizerContact" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'upcoming',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "bannerImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userPhone" TEXT,
    "eventId" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'confirmed',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_userId_eventId_key" ON "event_registrations"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
