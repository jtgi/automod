-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModeratedChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "url" TEXT,
    "userId" TEXT NOT NULL,
    "banThreshold" INTEGER,
    "excludeCohosts" BOOLEAN NOT NULL DEFAULT true,
    "excludeUsernames" TEXT NOT NULL DEFAULT '[]',
    "inclusionRuleSet" TEXT,
    "exclusionRuleSet" TEXT,
    "includeWhenNoMatch" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ModeratedChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ModeratedChannel" ("active", "banThreshold", "createdAt", "excludeCohosts", "excludeUsernames", "exclusionRuleSet", "id", "imageUrl", "inclusionRuleSet", "updatedAt", "url", "userId") SELECT "active", "banThreshold", "createdAt", "excludeCohosts", "excludeUsernames", "exclusionRuleSet", "id", "imageUrl", "inclusionRuleSet", "updatedAt", "url", "userId" FROM "ModeratedChannel";
DROP TABLE "ModeratedChannel";
ALTER TABLE "new_ModeratedChannel" RENAME TO "ModeratedChannel";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
