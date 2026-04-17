/*
  Warnings:

  - You are about to drop the `resource_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "resource_items" DROP CONSTRAINT "resource_items_createdById_fkey";

-- DropTable
DROP TABLE "resource_items";

-- DropEnum
DROP TYPE "ResourceType";

-- DropEnum
DROP TYPE "ResourceVisibility";
