-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "castHash" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "affectedUserFid" TEXT NOT NULL,
    "affectedUsername" TEXT NOT NULL,
    "affectedUserAvatarUrl" TEXT,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "ModerationLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ModerationLog" ("action", "affectedUserAvatarUrl", "affectedUserFid", "affectedUsername", "castHash", "channelId", "createdAt", "id", "reason", "updatedAt") SELECT "action", "affectedUserAvatarUrl", "affectedUserFid", "affectedUsername", "castHash", "channelId", "createdAt", "id", "reason", "updatedAt" FROM "ModerationLog";
DROP TABLE "ModerationLog";
ALTER TABLE "new_ModerationLog" RENAME TO "ModerationLog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
