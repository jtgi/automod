/*
  Warnings:

  - Added the required column `username` to the `Delegate` table without a default value. This is not possible if the table is not empty.

*/
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
    CONSTRAINT "Delegate_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Delegate" ("channelId", "createdAt", "fid", "id", "roleId", "updatedAt") SELECT "channelId", "createdAt", "fid", "id", "roleId", "updatedAt" FROM "Delegate";
DROP TABLE "Delegate";
ALTER TABLE "new_Delegate" RENAME TO "Delegate";
CREATE UNIQUE INDEX "Delegate_fid_channelId_key" ON "Delegate"("fid", "channelId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
