-- AlterTable
ALTER TABLE "ModeratedChannel" ALTER COLUMN "userId" DROP DEFAULT,
ALTER COLUMN "feedType" SET DEFAULT 'custom';
