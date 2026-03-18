/**
 * E2E 專用 fixture：建立掛帳測試用客戶。
 * 須先執行 pnpm db:seed，再執行本腳本。
 *
 * 用法：pnpm --filter pos-erp-backend e2e:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';
const E2E_ORDER_ID = 'e2e00002-0000-4000-8000-00000000o001';
const E2E_RN_ID = 'e2e00003-0000-4000-8000-00000000rn01';
const E2E_PO_ID = 'e2e00004-0000-4000-8000-00000000po01';
const E2E_BARCODE_SINGLE = 'E2E-BC-0001';
const E2E_BARCODE_MULTI = 'E2E-BC-0002';

const E2E_EX_SOURCE_ORDER_ID = 'e2e00005-0000-4000-8000-00000000x001';
const E2E_EX_DERIVED_ORDER_ID = 'e2e00006-0000-4000-8000-00000000x002';

// ---- CRM dispatch-rules fixtures (full profile only) ----
const E2E_DISPATCH_SEGMENT_ID = 'e2e00007-0000-4000-8000-00000000s001';
const E2E_DISPATCH_COUPON_ID = 'e2e00008-0000-4000-8000-00000000c001';
const E2E_DISPATCH_RULE_ENABLED_ID = 'e2e00009-0000-4000-8000-00000000r001';
const E2E_DISPATCH_RULE_DISABLED_ID = 'e2e00010-0000-4000-8000-00000000r002';
const E2E_DISPATCH_RULE_FUTURE_ID = 'e2e00011-0000-4000-8000-00000000r003';

const E2E_DISPATCH_SEGMENT_NAME = 'E2E-SEGMENT-NORMAL-0001';
const E2E_DISPATCH_COUPON_CODE = 'E2E-COUPON-0001';
const E2E_DISPATCH_RULE_ENABLED_NAME = 'E2E-RULE-ENABLED-0001';
const E2E_DISPATCH_RULE_DISABLED_NAME = 'E2E-RULE-DISABLED-0001';
const E2E_DISPATCH_RULE_FUTURE_NAME = 'E2E-RULE-FUTURE-0001';

// ---- Expiring inventory fixture (full profile only) ----
const E2E_EXPIRING_INVENTORY_REF = 'E2E-EXPIRING-INVENTORY-FIXTURE';
const E2E_EXPIRING_INVENTORY_BATCH = 'E2E-EXP-BATCH-0001';

export async function runE2ESeed(opts?: { profile?: string; client?: PrismaClient }) {
  const client = opts?.client ?? prisma;
  const merchant = await client.merchant.findFirst({
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

  await client.customer.upsert({
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
  const store = await client.store.findFirst({
    where: { merchantId: merchant.id },
    select: { id: true },
  });
  const warehouse = await client.warehouse.findFirst({
    where: { merchantId: merchant.id },
    select: { id: true },
  });
  const supplier = await client.supplier.findFirst({
    where: { merchantId: merchant.id, status: 'ACTIVE' },
    select: { id: true },
  });
  // Use a stable seed product to avoid cross-test interference.
  const product = await client.product.findUnique({
    where: { sku: 'DEMO-TEE-BLK-M' },
    select: { id: true },
  });
  if (!store || !warehouse || !supplier || !product) {
    throw new Error('缺少 store/warehouse/supplier/product。請先執行 pnpm db:seed');
  }

  const profile = (opts?.profile ?? process.env.E2E_PROFILE ?? '').trim().toLowerCase();
  const isFull = profile === 'full';

  // ---- Barcode fixtures ----
  // single: ensure exactly one product has barcode
  await client.product.updateMany({
    where: { barcode: E2E_BARCODE_SINGLE },
    data: { barcode: null },
  });
  await client.product.update({
    where: { id: product.id },
    data: { barcode: E2E_BARCODE_SINGLE },
  });

  // multi: ensure >=2 products share same barcode (full profile only)
  if (isFull) {
    const existing = await client.product.findMany({
      where: { barcode: E2E_BARCODE_MULTI },
      select: { id: true },
      take: 10,
    });
    if (existing.length < 2) {
      // create 2 dedicated products to avoid disturbing seed data
      await client.product.createMany({
        data: [
          {
            sku: 'E2E-BC-MULTI-001',
            name: 'E2E Barcode Multi 1',
            barcode: E2E_BARCODE_MULTI,
          },
          {
            sku: 'E2E-BC-MULTI-002',
            name: 'E2E Barcode Multi 2',
            barcode: E2E_BARCODE_MULTI,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  // POS order + FinanceEvent + PointLedger
  await client.financeEvent.deleteMany({ where: { referenceId: E2E_ORDER_ID } });
  await client.pointLedger.deleteMany({ where: { referenceId: E2E_ORDER_ID } });
  await client.posOrderPayment.deleteMany({ where: { orderId: E2E_ORDER_ID } });
  await client.posOrderItem.deleteMany({ where: { orderId: E2E_ORDER_ID } });
  await client.posOrder.deleteMany({ where: { id: E2E_ORDER_ID } });

  await client.posOrder.create({
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
  await client.financeEvent.createMany({
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
  await client.pointLedger.create({
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
  await client.financeEvent.deleteMany({ where: { referenceId: E2E_RN_ID } });
  await client.receivingNoteLine.deleteMany({ where: { receivingNoteId: E2E_RN_ID } });
  await client.receivingNote.deleteMany({ where: { id: E2E_RN_ID } });
  await client.purchaseOrderLine.deleteMany({ where: { poId: E2E_PO_ID } });
  await client.purchaseOrder.deleteMany({ where: { id: E2E_PO_ID } });

  const po = await client.purchaseOrder.create({
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
  await client.receivingNote.create({
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
  await client.financeEvent.create({
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

  // ---- Full profile: Exchange settlement + finance events fixtures ----
  if (isFull) {
    // ---- Dispatch-rules fixtures for runner acceptance (E2E) ----
    // teardown (must be replayable)
    await client.crmCouponDispatchRule.deleteMany({
      where: { merchantId: merchant.id, name: { in: [E2E_DISPATCH_RULE_ENABLED_NAME, E2E_DISPATCH_RULE_DISABLED_NAME, E2E_DISPATCH_RULE_FUTURE_NAME] } },
    });
    await client.loyaltyCouponIssue.deleteMany({ where: { couponId: E2E_DISPATCH_COUPON_ID } });
    await client.loyaltyCoupon.deleteMany({ where: { merchantId: merchant.id, id: E2E_DISPATCH_COUPON_ID } });
    await client.segment.deleteMany({ where: { merchantId: merchant.id, id: E2E_DISPATCH_SEGMENT_ID } });

    // create segment (memberLevel=NORMAL so it can target E2E customer)
    await client.segment.create({
      data: {
        id: E2E_DISPATCH_SEGMENT_ID,
        merchantId: merchant.id,
        name: E2E_DISPATCH_SEGMENT_NAME,
        conditions: { memberLevel: 'NORMAL' },
      },
    });

    // create coupon
    await client.loyaltyCoupon.create({
      data: {
        id: E2E_DISPATCH_COUPON_ID,
        merchantId: merchant.id,
        code: E2E_DISPATCH_COUPON_CODE,
        name: 'E2E Dispatch Coupon',
        discountType: 'FIXED',
        value: new Prisma.Decimal(10),
        active: true,
      },
    });

    const now = Date.now();
    const futureNextRunAt = new Date(now + 2 * 60 * 60 * 1000); // +2 hours, should not be picked by runner

    await client.crmCouponDispatchRule.createMany({
      data: [
        {
          id: E2E_DISPATCH_RULE_ENABLED_ID,
          merchantId: merchant.id,
          name: E2E_DISPATCH_RULE_ENABLED_NAME,
          segmentId: E2E_DISPATCH_SEGMENT_ID,
          couponId: E2E_DISPATCH_COUPON_ID,
          enabled: true,
          scheduleType: 'daily',
          cronExpr: '0 9 * * *',
          nextRunAt: new Date(0),
        },
        {
          id: E2E_DISPATCH_RULE_DISABLED_ID,
          merchantId: merchant.id,
          name: E2E_DISPATCH_RULE_DISABLED_NAME,
          segmentId: E2E_DISPATCH_SEGMENT_ID,
          couponId: E2E_DISPATCH_COUPON_ID,
          enabled: false,
          scheduleType: 'daily',
          cronExpr: '0 9 * * *',
          nextRunAt: new Date(0),
        },
        {
          id: E2E_DISPATCH_RULE_FUTURE_ID,
          merchantId: merchant.id,
          name: E2E_DISPATCH_RULE_FUTURE_NAME,
          segmentId: E2E_DISPATCH_SEGMENT_ID,
          couponId: E2E_DISPATCH_COUPON_ID,
          enabled: true,
          scheduleType: 'daily',
          cronExpr: '0 9 * * *',
          nextRunAt: futureNextRunAt,
        },
      ],
    });

    // Create a deterministic expiring inventory batch (expiryDate within 30 days by default).
    // Admin expiring inventory page uses InventoryEvent.expiryDate and SUM(quantity) > 0.
    await client.inventoryEvent.deleteMany({
      where: { referenceId: E2E_EXPIRING_INVENTORY_REF },
    });
    const baseFrom = new Date(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    const expiryDate = new Date(baseFrom);
    expiryDate.setDate(expiryDate.getDate() + 14);
    expiryDate.setHours(12, 0, 0, 0); // avoid edge issues around midnight/timezones

    await client.inventoryEvent.create({
      data: {
        occurredAt: new Date(),
        type: 'PURCHASE_IN',
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 5,
        batchCode: E2E_EXPIRING_INVENTORY_BATCH,
        expiryDate,
        referenceId: E2E_EXPIRING_INVENTORY_REF,
        note: 'E2E expiring inventory fixture',
      },
    });

    // teardown (orders & finance events)
    await client.financeEvent.deleteMany({ where: { referenceId: { in: [E2E_EX_SOURCE_ORDER_ID, E2E_EX_DERIVED_ORDER_ID] } } });
    await client.posOrderPayment.deleteMany({ where: { orderId: { in: [E2E_EX_SOURCE_ORDER_ID, E2E_EX_DERIVED_ORDER_ID] } } });
    await client.posOrderItem.deleteMany({ where: { orderId: { in: [E2E_EX_SOURCE_ORDER_ID, E2E_EX_DERIVED_ORDER_ID] } } });
    await client.posOrder.deleteMany({ where: { id: { in: [E2E_EX_SOURCE_ORDER_ID, E2E_EX_DERIVED_ORDER_ID] } } });

    // source order: paid 200
    await client.posOrder.create({
      data: {
        id: E2E_EX_SOURCE_ORDER_ID,
        orderNumber: 'E2E-EX-SOURCE-0001',
        storeId: store.id,
        customerId: E2E_CUSTOMER_ID,
        subtotalAmount: 200,
        discountAmount: 0,
        totalAmount: 200,
        items: { create: [{ productId: product.id, quantity: 2, unitPrice: 100 }] },
        payments: { create: [{ method: 'CASH', amount: 200 }] },
      },
    });

    // derived order: total 150, exchangeFromOrderId points to source
    await client.posOrder.create({
      data: {
        id: E2E_EX_DERIVED_ORDER_ID,
        orderNumber: 'E2E-EX-DERIVED-0001',
        storeId: store.id,
        customerId: E2E_CUSTOMER_ID,
        exchangeFromOrderId: E2E_EX_SOURCE_ORDER_ID,
        subtotalAmount: 150,
        discountAmount: 0,
        totalAmount: 150,
        items: { create: [{ productId: product.id, quantity: 1, unitPrice: 150 }] },
        payments: { create: [{ method: 'CASH', amount: 150 }] },
      },
    });

    // finance events: receivable/payment + refund for exchange settlement traceability
    await client.financeEvent.createMany({
      data: [
        {
          occurredAt: new Date(),
          type: 'SALE_RECEIVABLE',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 200,
          taxAmount: 0,
          referenceId: E2E_EX_SOURCE_ORDER_ID,
          note: 'E2E exchange source receivable',
        },
        {
          occurredAt: new Date(),
          type: 'SALE_PAYMENT',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 200,
          taxAmount: 0,
          referenceId: E2E_EX_SOURCE_ORDER_ID,
          note: 'E2E exchange source payment',
        },
        {
          occurredAt: new Date(),
          type: 'SALE_REFUND',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 50,
          taxAmount: 0,
          referenceId: E2E_EX_SOURCE_ORDER_ID,
          note: 'E2E exchange refund (delta)',
        },
      ],
    });

    // additional finance events for reports visibility (stable window)
    const reportDay = new Date();
    reportDay.setHours(12, 0, 0, 0);
    await client.financeEvent.createMany({
      data: [
        {
          occurredAt: reportDay,
          type: 'SALE_RECEIVABLE',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 300,
          taxAmount: 0,
          referenceId: 'E2E-REPORT-SALE-001',
          note: 'E2E report sale receivable',
        },
        {
          occurredAt: reportDay,
          type: 'SALE_PAYMENT',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 300,
          taxAmount: 0,
          referenceId: 'E2E-REPORT-SALE-001',
          note: 'E2E report sale payment',
        },
      ],
      skipDuplicates: true,
    });

    // finance report stable dataset (admin reports must not skip in full profile)
    await client.financeEvent.createMany({
      data: [
        {
          occurredAt: reportDay,
          type: 'PURCHASE_PAYABLE',
          partyId: `supplier:${supplier.id}`,
          currency: 'TWD',
          amount: 120,
          taxAmount: 0,
          referenceId: 'E2E-REPORT-PUR-001',
          note: 'E2E report purchase payable',
        },
        {
          occurredAt: reportDay,
          type: 'PURCHASE_REBATE',
          partyId: `supplier:${supplier.id}`,
          currency: 'TWD',
          amount: 20,
          taxAmount: 0,
          referenceId: 'E2E-REPORT-PUR-001',
          note: 'E2E report purchase rebate',
        },
      ],
      skipDuplicates: true,
    });

    // ---- fail-fast verification (for CI) ----
    const singleCount = await client.product.count({ where: { barcode: E2E_BARCODE_SINGLE } });
    if (singleCount !== 1) {
      throw new Error(`E2E fixture invalid: barcode single count=${singleCount} (expected 1)`);
    }
    const multiCount = await client.product.count({ where: { barcode: E2E_BARCODE_MULTI } });
    if (multiCount < 2) {
      throw new Error(`E2E fixture invalid: barcode multi count=${multiCount} (expected >=2)`);
    }
    const [srcOrder, derivedOrder] = await Promise.all([
      client.posOrder.findUnique({ where: { id: E2E_EX_SOURCE_ORDER_ID }, select: { id: true } }),
      client.posOrder.findUnique({ where: { id: E2E_EX_DERIVED_ORDER_ID }, select: { id: true, exchangeFromOrderId: true } }),
    ]);
    if (!srcOrder || !derivedOrder || derivedOrder.exchangeFromOrderId !== E2E_EX_SOURCE_ORDER_ID) {
      throw new Error('E2E fixture invalid: exchange orders missing or linkage broken');
    }
    const refundCount = await client.financeEvent.count({
      where: { referenceId: E2E_EX_SOURCE_ORDER_ID, type: 'SALE_REFUND' },
    });
    if (refundCount < 1) {
      throw new Error('E2E fixture invalid: SALE_REFUND missing for exchange source order');
    }
    const reportEventCount = await client.financeEvent.count({ where: { referenceId: 'E2E-REPORT-SALE-001' } });
    if (reportEventCount < 2) {
      throw new Error(`E2E fixture invalid: report finance events count=${reportEventCount} (expected >=2)`);
    }
    const reportPurCount = await client.financeEvent.count({ where: { referenceId: 'E2E-REPORT-PUR-001' } });
    if (reportPurCount < 2) {
      throw new Error(`E2E fixture invalid: report purchase events count=${reportPurCount} (expected >=2)`);
    }

    // Dispatch-rules fixtures sanity checks (full profile)
    const shouldRunCount = await client.crmCouponDispatchRule.count({
      where: {
        merchantId: merchant.id,
        enabled: true,
        scheduleType: 'daily',
        nextRunAt: { lte: new Date() },
        name: E2E_DISPATCH_RULE_ENABLED_NAME,
      },
    });
    if (shouldRunCount < 1) {
      throw new Error('E2E dispatch fixture invalid: enabled rule should be runnable');
    }

    const disabledCount = await client.crmCouponDispatchRule.count({
      where: { merchantId: merchant.id, name: E2E_DISPATCH_RULE_DISABLED_NAME, enabled: false },
    });
    if (disabledCount < 1) {
      throw new Error('E2E dispatch fixture invalid: disabled rule missing');
    }

    const futureCount = await client.crmCouponDispatchRule.count({
      where: { merchantId: merchant.id, name: E2E_DISPATCH_RULE_FUTURE_NAME, enabled: true, nextRunAt: { gt: new Date() } },
    });
    if (futureCount < 1) {
      throw new Error('E2E dispatch fixture invalid: future rule should not be runnable');
    }
  }

  console.log('E2E seed OK.');
  console.log('Customer id:', E2E_CUSTOMER_ID);
  console.log('POS order id (referenceId):', E2E_ORDER_ID);
  console.log('ReceivingNote id (referenceId):', E2E_RN_ID);
  console.log('Barcode single fixture (q):', E2E_BARCODE_SINGLE);
  if (isFull) {
    console.log('Barcode multi fixture (q):', E2E_BARCODE_MULTI);
    console.log('Exchange source order id:', E2E_EX_SOURCE_ORDER_ID);
    console.log('Exchange derived order id:', E2E_EX_DERIVED_ORDER_ID);
    console.log('E2E_PROFILE:', 'full');
  }
}

// Allow importing this file from tests without side effects.
if (require.main === module) {
  runE2ESeed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
