-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "providerId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "claimedInviteCodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "User_claimedInviteCodeId_fkey" FOREIGN KEY ("claimedInviteCodeId") REFERENCES "InviteCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "deletedAt", "email", "id", "name", "providerId", "updatedAt") SELECT "avatarUrl", "createdAt", "deletedAt", "email", "id", "name", "providerId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_providerId_key" ON "User"("providerId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
