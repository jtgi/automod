-- DropIndex
DROP INDEX "SignerAllocation_signerId_channelId_key";

-- AlterTable
ALTER TABLE "Status" ADD COLUMN "link" TEXT;
