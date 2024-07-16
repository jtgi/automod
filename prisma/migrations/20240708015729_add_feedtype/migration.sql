/*
  Warnings:

  - Added the required column `feedType` to the `ModeratedChannel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ModeratedChannel" ADD COLUMN     "feedType" TEXT NOT NULL DEFAULT "custom";
