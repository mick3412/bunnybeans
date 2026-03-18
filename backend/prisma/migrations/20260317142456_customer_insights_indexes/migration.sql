-- CreateIndex
CREATE INDEX "PosOrder_customerId_createdAt_idx" ON "PosOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PosOrderItem_orderId_idx" ON "PosOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PosOrderItem_productId_idx" ON "PosOrderItem"("productId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
