/*
  Warnings:

  - A unique constraint covering the columns `[channelId,monthYear]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Usage_channelId_monthYear_key" ON "Usage"("channelId", "monthYear");
