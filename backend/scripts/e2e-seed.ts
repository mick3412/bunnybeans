/**
 * E2E 專用 fixture：建立掛帳測試用客戶。
 * 須先執行 pnpm db:seed，再執行本腳本。
 *
 * 用法：pnpm --filter pos-erp-backend e2e:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';
const E2E_ORDER_ID = 'e2e00002-0000-4000-8000-00000000o001';
const E2E_RN_ID = 'e2e00003-0000-4000-8000-00000000rn01';
const E2E_PO_ID = 'e2e00004-0000-4000-8000-00000000po01';

async function main() {
  const merchant = await prisma.merchant.findFirst({
    where: { code: 'M001' },
    select: { id: true },
  });
  if (!merchant) {
    throw new Error('Merchant M001 不存在。請先執行 pnpm db:seed');
  }

  const join = (yOff: number, m: number, d: number) => {
    const y = new Date().getFullYear();
    return new Date(y - yOff, m, d);
  };

  await prisma.customer.upsert({
    where: { id: E2E_CUSTOMER_ID },
    create: {
      id: E2E_CUSTOMER_ID,
      merchantId: merchant.id,
      code: 'E2E',
      name: 'E2E 掛帳測試',
      phone: '0900000001',
      email: 'e2e@test.local',
      memberLevel: 'NORMAL',
      memberCode: 'M000',
      joinDate: join(2, 0, 15),
    },
    update: {
      merchantId: merchant.id,
      code: 'E2E',
      name: 'E2E 掛帳測試',
      phone: '0900000001',
      email: 'e2e@test.local',
      memberLevel: 'NORMAL',
      memberCode: 'M000',
    },
  });

  // ---- Drilldown fixtures (referenceId) ----
  const store = await prisma.store.findFirst({
    where: { merchantId: merchant.id },
    select: { id: true },
  });
  const warehouse = await prisma.warehouse.findFirst({
    where: { merchantId: merchant.id },
    select: { id: true },
  });
  const supplier = await prisma.supplier.findFirst({
    where: { merchantId: merchant.id, status: 'ACTIVE' },
    select: { id: true },
  });
  const product = await prisma.product.findFirst({
    select: { id: true },
  });
  if (!store || !warehouse || !supplier || !product) {
    throw new Error('缺少 store/warehouse/supplier/product。請先執行 pnpm db:seed');
  }

  // POS order + FinanceEvent + PointLedger
  await prisma.financeEvent.deleteMany({ where: { referenceId: E2E_ORDER_ID } });
  await prisma.pointLedger.deleteMany({ where: { referenceId: E2E_ORDER_ID } });
  await prisma.posOrderPayment.deleteMany({ where: { orderId: E2E_ORDER_ID } });
  await prisma.posOrderItem.deleteMany({ where: { orderId: E2E_ORDER_ID } });
  await prisma.posOrder.deleteMany({ where: { id: E2E_ORDER_ID } });

  await prisma.posOrder.create({
    data: {
      id: E2E_ORDER_ID,
      orderNumber: 'E2E-ORDER-0001',
      storeId: store.id,
      customerId: E2E_CUSTOMER_ID,
      subtotalAmount: 100,
      discountAmount: 0,
      totalAmount: 100,
      items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100 }] },
      payments: { create: [{ method: 'CASH', amount: 100 }] },
    },
  });
  await prisma.financeEvent.createMany({
    data: [
      {
        occurredAt: new Date(),
        type: 'SALE_RECEIVABLE',
        partyId: `customer:${E2E_CUSTOMER_ID}`,
        currency: 'TWD',
        amount: 100,
        taxAmount: 0,
        referenceId: E2E_ORDER_ID,
        note: 'E2E sale receivable',
      },
      {
        occurredAt: new Date(),
        type: 'SALE_PAYMENT',
        partyId: `customer:${E2E_CUSTOMER_ID}`,
        currency: 'TWD',
        amount: 100,
        taxAmount: 0,
        referenceId: E2E_ORDER_ID,
        note: 'E2E sale payment',
      },
    ],
  });
  await prisma.pointLedger.create({
    data: {
      merchantId: merchant.id,
      customerId: E2E_CUSTOMER_ID,
      type: 'EARNED',
      amount: 10,
      balanceAfter: 10,
      txnCode: 'SALE',
      referenceId: E2E_ORDER_ID,
      note: 'E2E earned',
    },
  });

  // ReceivingNote + FinanceEvent(PURCHASE_PAYABLE) to validate receivingNote drilldown
  await prisma.financeEvent.deleteMany({ where: { referenceId: E2E_RN_ID } });
  await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: E2E_RN_ID } });
  await prisma.receivingNote.deleteMany({ where: { id: E2E_RN_ID } });
  await prisma.purchaseOrderLine.deleteMany({ where: { poId: E2E_PO_ID } });
  await prisma.purchaseOrder.deleteMany({ where: { id: E2E_PO_ID } });

  const po = await prisma.purchaseOrder.create({
    data: {
      id: E2E_PO_ID,
      merchantId: merchant.id,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      orderNumber: 'E2E-PO-0001',
      status: 'ORDERED',
      lines: { create: [{ productId: product.id, qtyOrdered: 1, unitCost: 10 }] },
    },
    include: { lines: true },
  });
  await prisma.receivingNote.create({
    data: {
      id: E2E_RN_ID,
      merchantId: merchant.id,
      receiptNumber: 'E2E-RN-0001',
      purchaseOrderId: po.id,
      status: 'COMPLETED',
      lines: {
        create: [
          {
            purchaseOrderLineId: po.lines[0].id,
            orderedQty: 1,
            receivedQty: 1,
            qualifiedQty: 1,
            returnedQty: 0,
          },
        ],
      },
    },
  });
  await prisma.financeEvent.create({
    data: {
      occurredAt: new Date(),
      type: 'PURCHASE_PAYABLE',
      partyId: `supplier:${supplier.id}`,
      currency: 'TWD',
      amount: 10,
      taxAmount: 0,
      referenceId: E2E_RN_ID,
      note: 'E2E purchase payable',
    },
  });

  console.log('E2E seed OK.');
  console.log('Customer id:', E2E_CUSTOMER_ID);
  console.log('POS order id (referenceId):', E2E_ORDER_ID);
  console.log('ReceivingNote id (referenceId):', E2E_RN_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
