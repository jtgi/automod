-- CreateTable
CREATE TABLE "Comods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fid" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "Comods_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Comods_fid_channelId_key" ON "Comods"("fid", "channelId");
