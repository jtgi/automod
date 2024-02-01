/*
  Warnings:

  - The primary key for the `Frame` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Preorder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Frame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secretText" TEXT,
    "frameUrl" TEXT,
    "imageUrl" TEXT,
    "revealType" TEXT NOT NULL DEFAULT 'text',
    "preRevealText" TEXT NOT NULL,
    "requireLike" BOOLEAN NOT NULL DEFAULT false,
    "requireRecast" BOOLEAN NOT NULL DEFAULT false,
    "requireFollow" BOOLEAN NOT NULL DEFAULT false,
    "requireSomeoneIFollow" BOOLEAN NOT NULL DEFAULT false,
    "requireHoldERC721" BOOLEAN NOT NULL DEFAULT false,
    "requireHoldERC20" BOOLEAN NOT NULL DEFAULT false,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "requireERC721ContractAddress" TEXT,
    "requireERC721TokenId" TEXT,
    "requireERC721NetworkId" TEXT,
    "requireERC20ContractAddress" TEXT,
    "requireERC20NetworkId" TEXT,
    "requireERC20MinBalance" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "userId" TEXT,
    CONSTRAINT "Frame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Frame" ("active", "backgroundColor", "createdAt", "deletedAt", "frameUrl", "id", "imageUrl", "preRevealText", "requireERC20ContractAddress", "requireERC20MinBalance", "requireERC20NetworkId", "requireERC721ContractAddress", "requireERC721NetworkId", "requireERC721TokenId", "requireFollow", "requireHoldERC20", "requireHoldERC721", "requireLike", "requireRecast", "requireSomeoneIFollow", "revealType", "secretText", "slug", "textColor", "updatedAt", "userId") SELECT "active", "backgroundColor", "createdAt", "deletedAt", "frameUrl", "id", "imageUrl", "preRevealText", "requireERC20ContractAddress", "requireERC20MinBalance", "requireERC20NetworkId", "requireERC721ContractAddress", "requireERC721NetworkId", "requireERC721TokenId", "requireFollow", "requireHoldERC20", "requireHoldERC721", "requireLike", "requireRecast", "requireSomeoneIFollow", "revealType", "secretText", "slug", "textColor", "updatedAt", "userId" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE UNIQUE INDEX "Frame_slug_key" ON "Frame"("slug");
CREATE TABLE "new_Preorder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Preorder" ("createdAt", "deletedAt", "id", "providerId", "updatedAt") SELECT "createdAt", "deletedAt", "id", "providerId", "updatedAt" FROM "Preorder";
DROP TABLE "Preorder";
ALTER TABLE "new_Preorder" RENAME TO "Preorder";
CREATE UNIQUE INDEX "Preorder_providerId_key" ON "Preorder"("providerId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "providerId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "deletedAt", "email", "id", "name", "providerId", "updatedAt") SELECT "avatarUrl", "createdAt", "deletedAt", "email", "id", "name", "providerId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_providerId_key" ON "User"("providerId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
