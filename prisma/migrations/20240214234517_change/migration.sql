/*
  Warnings:

  - You are about to drop the column `userId` on the `Seen` table. All the data in the column will be lost.
  - Added the required column `userFid` to the `Seen` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Seen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userFid" TEXT NOT NULL,
    "toFid" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Seen_userFid_fkey" FOREIGN KEY ("userFid") REFERENCES "User" ("providerId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Seen" ("createdAt", "id", "result", "toFid", "updatedAt") SELECT "createdAt", "id", "result", "toFid", "updatedAt" FROM "Seen";
DROP TABLE "Seen";
ALTER TABLE "new_Seen" RENAME TO "Seen";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
