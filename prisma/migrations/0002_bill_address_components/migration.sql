-- AlterTable
ALTER TABLE "QuoteSession" DROP COLUMN "rawAddress",
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "addressTown" TEXT;
