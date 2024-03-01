/*
  Warnings:

  - Added the required column `username` to the `Comods` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "Comods_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Comods" ("channelId", "createdAt", "fid", "id", "updatedAt") SELECT "channelId", "createdAt", "fid", "id", "updatedAt" FROM "Comods";
DROP TABLE "Comods";
ALTER TABLE "new_Comods" RENAME TO "Comods";
CREATE UNIQUE INDEX "Comods_fid_channelId_key" ON "Comods"("fid", "channelId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
