-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Frame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "userId" INTEGER,
    CONSTRAINT "Frame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Frame" ("active", "backgroundColor", "createdAt", "deletedAt", "frameUrl", "id", "imageUrl", "preRevealText", "requireERC20ContractAddress", "requireERC20MinBalance", "requireERC20NetworkId", "requireERC721ContractAddress", "requireERC721NetworkId", "requireERC721TokenId", "requireFollow", "requireHoldERC20", "requireHoldERC721", "requireLike", "requireRecast", "requireSomeoneIFollow", "revealType", "secretText", "slug", "textColor", "updatedAt") SELECT "active", "backgroundColor", "createdAt", "deletedAt", "frameUrl", "id", "imageUrl", "preRevealText", "requireERC20ContractAddress", "requireERC20MinBalance", "requireERC20NetworkId", "requireERC721ContractAddress", "requireERC721NetworkId", "requireERC721TokenId", "requireFollow", "requireHoldERC20", "requireHoldERC721", "requireLike", "requireRecast", "requireSomeoneIFollow", "revealType", "secretText", "slug", "textColor", "updatedAt" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE UNIQUE INDEX "Frame_slug_key" ON "Frame"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
