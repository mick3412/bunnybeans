-- AlterTable
ALTER TABLE "PosOrder" ADD COLUMN "customerId" TEXT;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PosOrder_customerId_idx" ON "PosOrder"("customerId");
