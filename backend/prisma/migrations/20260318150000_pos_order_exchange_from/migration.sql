-- PosOrder.exchangeFromOrderId: trace exchange new order -> original order.

ALTER TABLE "PosOrder"
ADD COLUMN IF NOT EXISTS "exchangeFromOrderId" TEXT;

CREATE INDEX IF NOT EXISTS "PosOrder_exchangeFromOrderId_idx"
ON "PosOrder" ("exchangeFromOrderId");

