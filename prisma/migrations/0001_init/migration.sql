-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('UPLOADED', 'EXTRACTED', 'LOCATED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'SENT_TO_PARTNER', 'CLOSED', 'JUNK');

-- CreateTable
CREATE TABLE "QuoteSession" (
    "id" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'UPLOADED',
    "blobUrl" TEXT,
    "fileMimeType" TEXT,
    "kWhUsed" DOUBLE PRECISION,
    "billAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "billingPeriodDays" INTEGER,
    "rawAddress" TEXT,
    "utilityName" TEXT,
    "extractionConfidence" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "formattedAddress" TEXT,
    "specificYield" DOUBLE PRECISION,
    "systemKwp" DOUBLE PRECISION,
    "annualProductionKwh" DOUBLE PRECISION,
    "annualSavings" DOUBLE PRECISION,
    "paybackYears" DOUBLE PRECISION,
    "estimateJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "preferredContact" TEXT,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "quoteSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteSession_status_createdAt_idx" ON "QuoteSession"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_quoteSessionId_key" ON "Lead"("quoteSessionId");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_quoteSessionId_fkey" FOREIGN KEY ("quoteSessionId") REFERENCES "QuoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
