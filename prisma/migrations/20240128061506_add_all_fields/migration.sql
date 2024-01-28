/*
  Warnings:

  - You are about to drop the column `data` on the `Frame` table. All the data in the column will be lost.
  - Added the required column `backgroundColor` to the `Frame` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preRevealText` to the `Frame` table without a default value. This is not possible if the table is not empty.
  - Added the required column `textColor` to the `Frame` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "providerId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Frame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "imageUrl" TEXT,
    "preRevealText" TEXT NOT NULL,
    "requireLike" BOOLEAN NOT NULL DEFAULT false,
    "requireRecast" BOOLEAN NOT NULL DEFAULT false,
    "requireFollow" BOOLEAN NOT NULL DEFAULT false,
    "requireSomeoneIFollow" BOOLEAN NOT NULL DEFAULT false,
    "requireHoldNFT" BOOLEAN NOT NULL DEFAULT false,
    "requireHaveToken" BOOLEAN NOT NULL DEFAULT false,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "nftContractAddress" TEXT,
    "nftTokenId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Frame" ("active", "createdAt", "deletedAt", "id", "slug", "updatedAt") SELECT "active", "createdAt", "deletedAt", "id", "slug", "updatedAt" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE UNIQUE INDEX "Frame_slug_key" ON "Frame"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerId_key" ON "User"("providerId");
