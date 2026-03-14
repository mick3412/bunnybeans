-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "memberLevel" TEXT;

-- CreateTable
CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "draft" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "firstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
    "memberLevels" JSONB NOT NULL DEFAULT '[]',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionRule_merchantId_idx" ON "PromotionRule"("merchantId");
CREATE INDEX "PromotionRule_merchantId_priority_idx" ON "PromotionRule"("merchantId", "priority");

ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PosOrder: subtotal / discount / promotion snapshot
ALTER TABLE "PosOrder" ADD COLUMN IF NOT EXISTS "subtotalAmount" DECIMAL(12,2);
ALTER TABLE "PosOrder" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(12,2) DEFAULT 0;
ALTER TABLE "PosOrder" ADD COLUMN IF NOT EXISTS "promotionApplied" JSONB;

UPDATE "PosOrder" SET "subtotalAmount" = "totalAmount", "discountAmount" = 0 WHERE "subtotalAmount" IS NULL;

ALTER TABLE "PosOrder" ALTER COLUMN "subtotalAmount" SET NOT NULL;
ALTER TABLE "PosOrder" ALTER COLUMN "discountAmount" SET NOT NULL;
ALTER TABLE "PosOrder" ALTER COLUMN "discountAmount" SET DEFAULT 0;
