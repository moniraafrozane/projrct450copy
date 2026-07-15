-- Add position fields to users table
ALTER TABLE "users" ADD COLUMN "position" TEXT;
ALTER TABLE "users" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "assignedBy" TEXT;

-- Create enum type for Position
CREATE TYPE "Position" AS ENUM (
  'vicePresident',
  'generalSecretary',
  'eventCulturalSecretary',
  'sportSecretary',
  'publicationSecretary',
  'assistantEventCulturalSecretary',
  'executiveMember'
);

-- Alter column to use enum type
ALTER TABLE "users" ALTER COLUMN "position" TYPE "Position" USING "position"::"Position";
