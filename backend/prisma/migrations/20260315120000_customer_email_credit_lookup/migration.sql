-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_merchantId_phone_idx" ON "Customer"("merchantId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_merchantId_email_idx" ON "Customer"("merchantId", "email");
