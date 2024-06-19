-- DropIndex
DROP INDEX "ModerationLog_createdAt_idx";

-- CreateIndex
CREATE INDEX "ModerationLog_channelId_createdAt_idx" ON "ModerationLog"("channelId", "createdAt");
