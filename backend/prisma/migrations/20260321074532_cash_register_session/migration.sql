-- CreateTable
CREATE TABLE "CashRegisterSession" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCashAmount" DECIMAL(12,2) NOT NULL,
    "expectedCashAmount" DECIMAL(12,2),
    "actualCashAmount" DECIMAL(12,2),
    "differenceAmount" DECIMAL(12,2),
    "openedBy" TEXT,
    "closedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegisterSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashRegisterSession_storeId_status_openedAt_idx" ON "CashRegisterSession"("storeId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "CashRegisterSession_merchantId_openedAt_idx" ON "CashRegisterSession"("merchantId", "openedAt");

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
