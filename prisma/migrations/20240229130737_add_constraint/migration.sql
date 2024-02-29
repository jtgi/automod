/*
  Warnings:

  - A unique constraint covering the columns `[affectedUserId,channelId]` on the table `Cooldown` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Cooldown_affectedUserId_channelId_key" ON "Cooldown"("affectedUserId", "channelId");
