/*
  Warnings:

  - Made the column `channelId` on table `RuleSet` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `ModeratedChannel` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "RuleSet_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RuleSet" ("actions", "active", "channelId", "createdAt", "id", "rules", "updatedAt") SELECT "actions", "active", "channelId", "createdAt", "id", "rules", "updatedAt" FROM "RuleSet";
DROP TABLE "RuleSet";
ALTER TABLE "new_RuleSet" RENAME TO "RuleSet";
CREATE TABLE "new_ModeratedChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ModeratedChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ModeratedChannel" ("active", "createdAt", "id", "updatedAt", "userId") SELECT "active", "createdAt", "id", "updatedAt", "userId" FROM "ModeratedChannel";
DROP TABLE "ModeratedChannel";
ALTER TABLE "new_ModeratedChannel" RENAME TO "ModeratedChannel";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
