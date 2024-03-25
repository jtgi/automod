/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Usage` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Usage` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "castsProcessed" INTEGER NOT NULL DEFAULT 0,
    "monthYear" TEXT NOT NULL,
    CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Usage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Usage" ("castsProcessed", "channelId", "id", "monthYear") SELECT "castsProcessed", "channelId", "id", "monthYear" FROM "Usage";
DROP TABLE "Usage";
ALTER TABLE "new_Usage" RENAME TO "Usage";
CREATE INDEX "Usage_channelId_monthYear_idx" ON "Usage"("channelId", "monthYear");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
