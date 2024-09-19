/*
  Warnings:

  - You are about to drop the `RuleSet` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RuleSet" DROP CONSTRAINT "RuleSet_channelId_fkey";

-- DropTable
DROP TABLE "RuleSet";
