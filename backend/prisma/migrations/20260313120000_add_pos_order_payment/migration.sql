-- CreateTable
CREATE TABLE "PosOrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PosOrderPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PosOrderPayment" ADD CONSTRAINT "PosOrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
