-- CreateTable
CREATE TABLE "CastLog" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "CastLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
