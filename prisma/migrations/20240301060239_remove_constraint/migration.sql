-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cooldown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "affectedUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "Cooldown_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Cooldown" ("active", "affectedUserId", "channelId", "createdAt", "expiresAt", "id", "updatedAt") SELECT "active", "affectedUserId", "channelId", "createdAt", "expiresAt", "id", "updatedAt" FROM "Cooldown";
DROP TABLE "Cooldown";
ALTER TABLE "new_Cooldown" RENAME TO "Cooldown";
CREATE UNIQUE INDEX "Cooldown_affectedUserId_channelId_key" ON "Cooldown"("affectedUserId", "channelId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
