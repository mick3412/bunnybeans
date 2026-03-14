-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivingNoteStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'RETURNED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "paymentTerms" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "bankAccount" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "orderDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingNote" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "inspectorName" TEXT,
    "remark" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "status" "ReceivingNoteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingNoteLine" (
    "id" TEXT NOT NULL,
    "receivingNoteId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "qualifiedQty" INTEGER NOT NULL DEFAULT 0,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "returnReason" TEXT,

    CONSTRAINT "ReceivingNoteLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_merchantId_code_key" ON "Supplier"("merchantId", "code");
CREATE INDEX "Supplier_merchantId_idx" ON "Supplier"("merchantId");

CREATE UNIQUE INDEX "PurchaseOrder_merchantId_orderNumber_key" ON "PurchaseOrder"("merchantId", "orderNumber");
CREATE INDEX "PurchaseOrder_merchantId_idx" ON "PurchaseOrder"("merchantId");
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");

CREATE UNIQUE INDEX "ReceivingNote_receiptNumber_key" ON "ReceivingNote"("receiptNumber");
CREATE INDEX "ReceivingNote_merchantId_idx" ON "ReceivingNote"("merchantId");
CREATE INDEX "ReceivingNote_purchaseOrderId_idx" ON "ReceivingNote"("purchaseOrderId");

CREATE INDEX "ReceivingNoteLine_receivingNoteId_idx" ON "ReceivingNoteLine"("receivingNoteId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingNote" ADD CONSTRAINT "ReceivingNote_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceivingNote" ADD CONSTRAINT "ReceivingNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingNoteLine" ADD CONSTRAINT "ReceivingNoteLine_receivingNoteId_fkey" FOREIGN KEY ("receivingNoteId") REFERENCES "ReceivingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceivingNoteLine" ADD CONSTRAINT "ReceivingNoteLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
