-- CreateTable
CREATE TABLE "IrradianceCache" (
    "id" TEXT NOT NULL,
    "latKey" DOUBLE PRECISION NOT NULL,
    "lngKey" DOUBLE PRECISION NOT NULL,
    "specificYield" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrradianceCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IrradianceCache_latKey_lngKey_key" ON "IrradianceCache"("latKey", "lngKey");
