/*
  Warnings:

  - You are about to drop the `PropagationDelay` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "PropagationDelay";

-- CreateTable
CREATE TABLE "PropagationDelayCheck" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "dst" TEXT NOT NULL,

    CONSTRAINT "PropagationDelayCheck_pkey" PRIMARY KEY ("id")
);
