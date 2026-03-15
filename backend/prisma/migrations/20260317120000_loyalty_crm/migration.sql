-- CreateEnum
CREATE TYPE "PointLedgerType" AS ENUM ('EARNED', 'BURNED', 'LOCKED', 'EXPIRED');

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "memberCode" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3);

-- AlterTable PromotionRule
ALTER TABLE "PromotionRule" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable LoyaltySettings
CREATE TABLE IF NOT EXISTS "LoyaltySettings" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "earnPerNT" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "pointValueNT" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "birthdayMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "rollingDays" INTEGER NOT NULL DEFAULT 365,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltySettings_merchantId_key" ON "LoyaltySettings"("merchantId");
ALTER TABLE "LoyaltySettings" DROP CONSTRAINT IF EXISTS "LoyaltySettings_merchantId_fkey";
ALTER TABLE "LoyaltySettings" ADD CONSTRAINT "LoyaltySettings_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable PointLedger
CREATE TABLE IF NOT EXISTS "PointLedger" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "PointLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "txnCode" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PointLedger_merchantId_customerId_createdAt_idx" ON "PointLedger"("merchantId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointLedger_merchantId_type_idx" ON "PointLedger"("merchantId", "type");
ALTER TABLE "PointLedger" DROP CONSTRAINT IF EXISTS "PointLedger_merchantId_fkey";
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointLedger" DROP CONSTRAINT IF EXISTS "PointLedger_customerId_fkey";
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable LoyaltyCoupon
CREATE TABLE IF NOT EXISTS "LoyaltyCoupon" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyCoupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyCoupon_merchantId_code_key" ON "LoyaltyCoupon"("merchantId", "code");
CREATE INDEX IF NOT EXISTS "LoyaltyCoupon_merchantId_idx" ON "LoyaltyCoupon"("merchantId");
ALTER TABLE "LoyaltyCoupon" DROP CONSTRAINT IF EXISTS "LoyaltyCoupon_merchantId_fkey";
ALTER TABLE "LoyaltyCoupon" ADD CONSTRAINT "LoyaltyCoupon_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
