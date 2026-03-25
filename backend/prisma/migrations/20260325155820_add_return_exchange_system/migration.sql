-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('FULL_RETURN', 'PARTIAL_RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('SIZE_WRONG', 'DEFECTIVE', 'CHANGED_MIND', 'WRONG_ITEM', 'DUPLICATE_PURCHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'DEFECTIVE_ITEM');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('CASH', 'STORE_CREDIT');

-- AlterEnum
ALTER TYPE "InventoryEventType" ADD VALUE 'SCRAP_LOSS';

-- CreateTable
CREATE TABLE "PosReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "type" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "returnSubtotal" DECIMAL(12,2) NOT NULL,
    "discountShare" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "refundMethod" "RefundMethod" NOT NULL,
    "pointsDeducted" INTEGER NOT NULL DEFAULT 0,
    "pointsReturned" INTEGER NOT NULL DEFAULT 0,
    "exchangeOrderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "note" TEXT,

    CONSTRAINT "PosReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditLedger" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnPolicy" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "exchangeWindowDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosReturn_returnNumber_key" ON "PosReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "PosReturn_orderId_idx" ON "PosReturn"("orderId");

-- CreateIndex
CREATE INDEX "PosReturn_storeId_createdAt_idx" ON "PosReturn"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "PosReturnItem_returnId_idx" ON "PosReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "StoreCreditLedger_merchantId_customerId_createdAt_idx" ON "StoreCreditLedger"("merchantId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnPolicy_merchantId_key" ON "ReturnPolicy"("merchantId");

-- AddForeignKey
ALTER TABLE "PosReturn" ADD CONSTRAINT "PosReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosReturnItem" ADD CONSTRAINT "PosReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PosReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
