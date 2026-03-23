-- CreateTable
CREATE TABLE "PosHeldCart" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "items_json" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosHeldCart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosHeldCart_storeId_heldAt_idx" ON "PosHeldCart"("storeId", "heldAt");

-- AddForeignKey
ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
