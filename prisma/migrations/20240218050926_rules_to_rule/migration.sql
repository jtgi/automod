/*
  Warnings:

  - You are about to drop the column `rules` on the `RuleSet` table. All the data in the column will be lost.
  - Added the required column `rule` to the `RuleSet` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rule" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "RuleSet_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RuleSet" ("actions", "active", "channelId", "createdAt", "id", "updatedAt") SELECT "actions", "active", "channelId", "createdAt", "id", "updatedAt" FROM "RuleSet";
DROP TABLE "RuleSet";
ALTER TABLE "new_RuleSet" RENAME TO "RuleSet";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
