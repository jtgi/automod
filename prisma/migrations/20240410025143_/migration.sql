/*
  Warnings:

  - A unique constraint covering the columns `[fid,roleId,channelId]` on the table `Delegate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Delegate_fid_channelId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Delegate_fid_roleId_channelId_key" ON "Delegate"("fid", "roleId", "channelId");
