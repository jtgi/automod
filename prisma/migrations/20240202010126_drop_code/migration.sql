/*
  Warnings:

  - You are about to drop the column `code` on the `InviteCode` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_InviteCode" ("active", "createdAt", "deletedAt", "id", "limit", "updatedAt") SELECT "active", "createdAt", "deletedAt", "id", "limit", "updatedAt" FROM "InviteCode";
DROP TABLE "InviteCode";
ALTER TABLE "new_InviteCode" RENAME TO "InviteCode";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
