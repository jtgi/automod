-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "fid" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "inviteCodeId" TEXT,
    "planExpiry" TIMESTAMPTZ(6),
    "planTokenId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratedChannel" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "url" TEXT,
    "userId" TEXT NOT NULL,
    "banThreshold" INTEGER,
    "slowModeHours" INTEGER NOT NULL DEFAULT 0,
    "excludeCohosts" BOOLEAN NOT NULL DEFAULT true,
    "excludeUsernames" TEXT NOT NULL DEFAULT '[]',
    "inclusionRuleSet" TEXT,
    "exclusionRuleSet" TEXT,

    CONSTRAINT "ModeratedChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "fid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "Delegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT NOT NULL,
    "isEveryoneRole" BOOLEAN NOT NULL DEFAULT false,
    "isCohostRole" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Downvote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "fid" TEXT NOT NULL,
    "castHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "Downvote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comods" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "fid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "Comods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "target" TEXT NOT NULL DEFAULT 'all',
    "rule" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "castHash" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "affectedUserFid" TEXT NOT NULL,
    "affectedUsername" TEXT NOT NULL,
    "affectedUserAvatarUrl" TEXT,
    "channelId" TEXT NOT NULL,
    "castText" TEXT,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),
    "type" TEXT NOT NULL,
    "link" TEXT,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooldown" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "affectedUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "Cooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "castsProcessed" INTEGER NOT NULL DEFAULT 0,
    "monthYear" TEXT NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastLog" (
    "hash" TEXT NOT NULL,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "CastLog_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "signerUuid" TEXT NOT NULL,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignerAllocation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "signerId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "SignerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "type" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_fid_key" ON "Order"("fid");

-- CreateIndex
CREATE UNIQUE INDEX "Otp_code_key" ON "Otp"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Delegate_fid_roleId_channelId_key" ON "Delegate"("fid", "roleId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Downvote_fid_castHash_key" ON "Downvote"("fid", "castHash");

-- CreateIndex
CREATE UNIQUE INDEX "Comods_fid_channelId_key" ON "Comods"("fid", "channelId");

-- CreateIndex
CREATE INDEX "ModerationLog_channelId_createdAt_idx" ON "ModerationLog"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cooldown_affectedUserId_channelId_key" ON "Cooldown"("affectedUserId", "channelId");

-- CreateIndex
CREATE INDEX "Usage_channelId_monthYear_idx" ON "Usage"("channelId", "monthYear");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_channelId_monthYear_key" ON "Usage"("channelId", "monthYear");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_nonce_userId_key" ON "Notification"("nonce", "userId");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratedChannel" ADD CONSTRAINT "ModeratedChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegate" ADD CONSTRAINT "Delegate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegate" ADD CONSTRAINT "Delegate_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Downvote" ADD CONSTRAINT "Downvote_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comods" ADD CONSTRAINT "Comods_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooldown" ADD CONSTRAINT "Cooldown_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignerAllocation" ADD CONSTRAINT "SignerAllocation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ModeratedChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignerAllocation" ADD CONSTRAINT "SignerAllocation_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
