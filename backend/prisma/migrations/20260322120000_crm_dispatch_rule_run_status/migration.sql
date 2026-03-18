-- AlterTable
ALTER TABLE "CrmCouponDispatchRule"
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "lastRunCode" TEXT,
ADD COLUMN     "lastRunNote" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmCouponDispatchRule_merchantId_lastRunAt_idx" ON "CrmCouponDispatchRule"("merchantId", "lastRunAt");

