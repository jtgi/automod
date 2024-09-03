-- CreateTable
CREATE TABLE "PropagationDelay" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "dst" TEXT NOT NULL,

    CONSTRAINT "PropagationDelay_pkey" PRIMARY KEY ("id")
);
