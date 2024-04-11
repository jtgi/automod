-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delegate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "Delegate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delegate_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Delegate" ("avatarUrl", "channelId", "createdAt", "fid", "id", "roleId", "updatedAt", "username") SELECT "avatarUrl", "channelId", "createdAt", "fid", "id", "roleId", "updatedAt", "username" FROM "Delegate";
DROP TABLE "Delegate";
ALTER TABLE "new_Delegate" RENAME TO "Delegate";
CREATE UNIQUE INDEX "Delegate_fid_roleId_channelId_key" ON "Delegate"("fid", "roleId", "channelId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
