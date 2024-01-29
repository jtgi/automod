/*
  Warnings:

  - You are about to drop the column `erc20ContractAddress` on the `Frame` table. All the data in the column will be lost.
  - You are about to drop the column `erc20MinBalance` on the `Frame` table. All the data in the column will be lost.
  - You are about to drop the column `nftContractAddress` on the `Frame` table. All the data in the column will be lost.
  - You are about to drop the column `nftTokenId` on the `Frame` table. All the data in the column will be lost.
  - You are about to drop the column `requireHoldNFT` on the `Frame` table. All the data in the column will be lost.

*/
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
    "requireHoldERC721" BOOLEAN NOT NULL DEFAULT false,
    "requireHaveToken" BOOLEAN NOT NULL DEFAULT false,
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
    "deletedAt" DATETIME
);
INSERT INTO "new_Frame" ("active", "backgroundColor", "createdAt", "deletedAt", "id", "imageUrl", "preRevealText", "requireFollow", "requireHaveToken", "requireLike", "requireRecast", "requireSomeoneIFollow", "slug", "text", "textColor", "type", "updatedAt") SELECT "active", "backgroundColor", "createdAt", "deletedAt", "id", "imageUrl", "preRevealText", "requireFollow", "requireHaveToken", "requireLike", "requireRecast", "requireSomeoneIFollow", "slug", "text", "textColor", "type", "updatedAt" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE UNIQUE INDEX "Frame_slug_key" ON "Frame"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
