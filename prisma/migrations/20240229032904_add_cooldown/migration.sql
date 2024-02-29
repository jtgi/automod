-- CreateTable
CREATE TABLE "Cooldown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "affectedUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "Cooldown_affectedUserId_fkey" FOREIGN KEY ("affectedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Cooldown_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "inviteCodeId" TEXT,
    CONSTRAINT "User_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "id", "inviteCodeId", "name", "plan", "role", "updatedAt") SELECT "avatarUrl", "createdAt", "email", "id", "inviteCodeId", "name", "plan", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
