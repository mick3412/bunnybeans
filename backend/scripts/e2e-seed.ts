/**
 * E2E 專用 fixture：建立掛帳測試用客戶。
 * 須先執行 pnpm db:seed，再執行本腳本。
 *
 * 用法：pnpm --filter pos-erp-backend e2e:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';
// NOTE: `ReferenceIdLink` only treats UUID-like (pure hex) referenceId as clickable.
// Keep these IDs stable and strictly match the UUID-like regex:
// ^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
const E2E_ORDER_ID = 'e2e00002-0000-4000-8000-00000000a001';
const E2E_RN_ID = 'e2e00003-0000-4000-8000-00000000b001';
const E2E_PO_ID = 'e2e00004-0000-4000-8000-00000000po01';
const E2E_BARCODE_SINGLE = 'E2E-BC-0001';
const E2E_BARCODE_MULTI = 'E2E-BC-0002';

const E2E_EX_SOURCE_ORDER_ID = 'e2e00005-0000-4000-8000-00000000d001';
const E2E_EX_DERIVED_ORDER_ID = 'e2e00006-0000-4000-8000-00000000e002';

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

// ---- Other fixed E2E identifiers (used by full profile + CI triage logs) ----
const E2E_REPLENISH_SALE_REF = 'E2E-REPL-SALE-001';
const E2E_RN_RECEIPT_NUMBER = 'E2E-RN-0001';
const E2E_REPORT_SALE_REF = 'E2E-REPORT-SALE-001';
const E2E_REPORT_PUR_REF = 'E2E-REPORT-PUR-001';

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

  // Deterministic finance `occurredAt` for E2E: ensure the first clickable `ReferenceIdLink`
  // in `/admin/reports` is a `posOrder` (not `receivingNote`).
  // All are still within `last30d`, so the list page won't be empty.
  const nowMs = Date.now();
  const tDrilldownOrderFinance = new Date(nowMs - 20_000);
  const tDrilldownReceivingNoteFinance = new Date(nowMs - 10_000);
  const tExchangeFinance = new Date(nowMs);

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
  // teardown must handle referenceId changes across releases:
  // old runs might have left rows with the same `orderNumber` but different `id`.
  {
    const existingOrderIds = await client.posOrder.findMany({
      where: { orderNumber: 'E2E-ORDER-0001' },
      select: { id: true },
    });
    const orderIdsToDelete = Array.from(new Set([...existingOrderIds.map((r) => r.id), E2E_ORDER_ID]));
    if (orderIdsToDelete.length) {
      await client.financeEvent.deleteMany({ where: { referenceId: { in: orderIdsToDelete } } });
      await client.pointLedger.deleteMany({ where: { referenceId: { in: orderIdsToDelete } } });
      await client.posOrderPayment.deleteMany({ where: { orderId: { in: orderIdsToDelete } } });
      await client.posOrderItem.deleteMany({ where: { orderId: { in: orderIdsToDelete } } });
      await client.posOrder.deleteMany({ where: { id: { in: orderIdsToDelete } } });
    }
  }

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
        occurredAt: tDrilldownOrderFinance,
        type: 'SALE_RECEIVABLE',
        partyId: `customer:${E2E_CUSTOMER_ID}`,
        currency: 'TWD',
        amount: 100,
        taxAmount: 0,
        referenceId: E2E_ORDER_ID,
        note: 'E2E sale receivable',
      },
      {
        occurredAt: tDrilldownOrderFinance,
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
  // teardown must handle referenceId changes across releases:
  // old runs might have left rows with the same `receiptNumber` but different `id`.
  {
    const existingRnIds = await client.receivingNote.findMany({
      where: { receiptNumber: E2E_RN_RECEIPT_NUMBER },
      select: { id: true },
    });
    const rnIdsToDelete = Array.from(new Set([...existingRnIds.map((r) => r.id), E2E_RN_ID]));
    if (rnIdsToDelete.length) {
      await client.financeEvent.deleteMany({ where: { referenceId: { in: rnIdsToDelete } } });
      await client.receivingNoteLine.deleteMany({ where: { receivingNoteId: { in: rnIdsToDelete } } });
      await client.receivingNote.deleteMany({ where: { id: { in: rnIdsToDelete } } });
    }
  }
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
      receiptNumber: E2E_RN_RECEIPT_NUMBER,
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
      occurredAt: tDrilldownReceivingNoteFinance,
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

    // ---- Full profile: Replenishment suggestions must not be empty (E2E smoke) ----
    // Admin replenishment suggestions require:
    // - inventoryBalance.onHandQty (current stock)
    // - inventoryEvent of type SALE_OUT within daysLookback (default 30)
    // to compute suggestedQty > 0.
    const e2eNow = new Date();
    const occurredAt = new Date(e2eNow.getTime() - 10 * 24 * 3600 * 1000); // within default lookback=30
    const soldQty = 50;

    await client.inventoryEvent.deleteMany({ where: { referenceId: E2E_REPLENISH_SALE_REF } });

    // Make sure there is a stable low stock baseline for the selected product/warehouse.
    await client.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: { onHandQty: 0 },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 0 },
    });

    await client.inventoryEvent.create({
      data: {
        occurredAt,
        type: 'SALE_OUT',
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: soldQty,
        referenceId: E2E_REPLENISH_SALE_REF,
        note: 'E2E replenishment-suggestions fixture',
      },
    });

    // teardown (orders & finance events)
    {
      // teardown must handle referenceId changes across releases:
      // old runs might have left rows with the same `orderNumber` but different `id`.
      const existingExchangeOrderIds = await client.posOrder.findMany({
        where: { orderNumber: { in: ['E2E-EX-SOURCE-0001', 'E2E-EX-DERIVED-0001'] } },
        select: { id: true },
      });
      const exchangeOrderIdsToDelete = Array.from(
        new Set([
          ...existingExchangeOrderIds.map((r) => r.id),
          E2E_EX_SOURCE_ORDER_ID,
          E2E_EX_DERIVED_ORDER_ID,
        ]),
      );
      if (exchangeOrderIdsToDelete.length) {
        await client.financeEvent.deleteMany({ where: { referenceId: { in: exchangeOrderIdsToDelete } } });
        await client.posOrderPayment.deleteMany({ where: { orderId: { in: exchangeOrderIdsToDelete } } });
        await client.posOrderItem.deleteMany({ where: { orderId: { in: exchangeOrderIdsToDelete } } });
        await client.posOrder.deleteMany({ where: { id: { in: exchangeOrderIdsToDelete } } });
      }
    }

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
          occurredAt: tExchangeFinance,
          type: 'SALE_RECEIVABLE',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 200,
          taxAmount: 0,
          referenceId: E2E_EX_SOURCE_ORDER_ID,
          note: 'E2E exchange source receivable',
        },
        {
          occurredAt: tExchangeFinance,
          type: 'SALE_PAYMENT',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 200,
          taxAmount: 0,
          referenceId: E2E_EX_SOURCE_ORDER_ID,
          note: 'E2E exchange source payment',
        },
        {
          occurredAt: tExchangeFinance,
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
          referenceId: E2E_REPORT_SALE_REF,
          note: 'E2E report sale receivable',
        },
        {
          occurredAt: reportDay,
          type: 'SALE_PAYMENT',
          partyId: `customer:${E2E_CUSTOMER_ID}`,
          currency: 'TWD',
          amount: 300,
          taxAmount: 0,
          referenceId: E2E_REPORT_SALE_REF,
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
          referenceId: E2E_REPORT_PUR_REF,
          note: 'E2E report purchase payable',
        },
        {
          occurredAt: reportDay,
          type: 'PURCHASE_REBATE',
          partyId: `supplier:${supplier.id}`,
          currency: 'TWD',
          amount: 20,
          taxAmount: 0,
          referenceId: E2E_REPORT_PUR_REF,
          note: 'E2E report purchase rebate',
        },
      ],
      skipDuplicates: true,
    });

    // ---- fail-fast verification (for CI) ----
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const assertUuidLike = (name: string, value: string) => {
      if (!UUID_RE.test(value.trim())) {
        throw new Error(`E2E fixture invalid: ${name} is not UUID-like: "${value}"`);
      }
    };

    assertUuidLike('E2E_ORDER_ID', E2E_ORDER_ID);
    assertUuidLike('E2E_RN_ID', E2E_RN_ID);
    assertUuidLike('E2E_EX_SOURCE_ORDER_ID', E2E_EX_SOURCE_ORDER_ID);
    assertUuidLike('E2E_EX_DERIVED_ORDER_ID', E2E_EX_DERIVED_ORDER_ID);

    // Replenishment suggestions sanity check (avoid long-term empty list on full profile)
    const lookbackDays = 30;
    const daysAhead = 30;
    const safetyDays = 7;
    const balance = await client.inventoryBalance.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHandQty: true },
    });
    if (!balance) {
      throw new Error(
        `E2E fixture invalid: inventoryBalance missing for replenishment fixture referenceId=${E2E_REPLENISH_SALE_REF} productId=${product.id} warehouseId=${warehouse.id}`,
      );
    }
    // UI defaults expect onHand low enough so suggestedQty > 0.
    if (balance.onHandQty > 0) {
      throw new Error(
        `E2E fixture invalid: replenishment fixture expects inventoryBalance.onHandQty=0 (referenceId=${E2E_REPLENISH_SALE_REF}), got=${balance.onHandQty}`,
      );
    }
    const replSales = await client.inventoryEvent.findMany({
      where: { referenceId: E2E_REPLENISH_SALE_REF, type: 'SALE_OUT' },
      select: { quantity: true, occurredAt: true },
    });
    if (replSales.length < 1) {
      throw new Error(
        `E2E fixture invalid: replenishment suggestions missing inventoryEvent type=SALE_OUT referenceId=${E2E_REPLENISH_SALE_REF} count=${replSales.length}`,
      );
    }
    const totalSold = replSales.reduce((s, r) => s + Math.abs(r.quantity), 0);
    if (totalSold <= 0) {
      throw new Error(
        `E2E fixture invalid: replenishment suggestions totalSold must be > 0 (referenceId=${E2E_REPLENISH_SALE_REF}), totalSold=${totalSold} samples=${replSales.length}`,
      );
    }
    const minOccuredAt = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000);
    const outOfLookback = replSales
      .filter((r) => r.occurredAt < minOccuredAt)
      .slice(0, 5)
      .map((r) => r.occurredAt.toISOString());
    if (outOfLookback.length) {
      throw new Error(
        `E2E fixture invalid: replenishment suggestions occurredAt out of lookback window (referenceId=${E2E_REPLENISH_SALE_REF}) expected>=${minOccuredAt.toISOString()} sample=${outOfLookback.join(',')}`,
      );
    }

    const avgDailySales = totalSold / lookbackDays;
    const targetStockRaw = avgDailySales * (daysAhead + safetyDays);
    const targetStock = Math.max(0, Math.round(targetStockRaw * 100) / 100);
    const delta = targetStock - balance.onHandQty;
    const suggestedQty = Math.max(0, Math.ceil(delta));
    if (suggestedQty <= 0) {
      throw new Error(
        `E2E fixture invalid: replenishment suggestions suggestedQty must be > 0 (referenceId=${E2E_REPLENISH_SALE_REF}), suggestedQty=${suggestedQty} delta=${delta} onHandQty=${balance.onHandQty}`,
      );
    }

    // ---- Expiring inventory: full gate expects the UI to find at least one batch ----
    // Admin expiring inventory page default `daysAhead` is 30.
    const expiringDaysAhead = 30;
    const expiringFrom = new Date(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD @ UTC midnight (align with service)
    const expiringTo = new Date(expiringFrom);
    expiringTo.setDate(expiringTo.getDate() + expiringDaysAhead);

    const expEvents = await client.inventoryEvent.findMany({
      where: {
        referenceId: E2E_EXPIRING_INVENTORY_REF,
        type: 'PURCHASE_IN',
        batchCode: E2E_EXPIRING_INVENTORY_BATCH,
      },
      select: { quantity: true, expiryDate: true },
    });

    const expAllCount = expEvents.length;
    const expAllSumQty = expEvents.reduce((s, r) => s + Math.abs(r.quantity), 0);

    const inRange = expEvents.filter(
      (e) => e.expiryDate && e.expiryDate >= expiringFrom && e.expiryDate <= expiringTo,
    );
    const inRangeCount = inRange.length;
    const inRangeSumQty = inRange.reduce((s, r) => s + Math.abs(r.quantity), 0);

    if (expAllCount < 1 || expAllSumQty <= 0) {
      throw new Error(
        `E2E fixture invalid: expiring inventory missing/empty (batchCode=${E2E_EXPIRING_INVENTORY_BATCH} referenceId=${E2E_EXPIRING_INVENTORY_REF}) allCount=${expAllCount} allSumQty=${expAllSumQty}`,
      );
    }
    if (inRangeCount < 1 || inRangeSumQty <= 0) {
      const expirySamples = expEvents
        .filter((e) => e.expiryDate)
        .slice(0, 5)
        .map((e) => e.expiryDate!.toISOString());
      throw new Error(
        `E2E fixture invalid: expiring inventory batch must fall within expiring window (batchCode=${E2E_EXPIRING_INVENTORY_BATCH} referenceId=${E2E_EXPIRING_INVENTORY_REF}) expected expiryDate in [${expiringFrom.toISOString()}, ${expiringTo.toISOString()}], inRangeCount=${inRangeCount} inRangeSumQty=${inRangeSumQty} expirySamples=${expirySamples.join(',')}`,
      );
    }

    // ---- ReceivingNote return-to-supplier: must allow minimal RETURN_TO_SUPPLIER qty=1 ----
    const rn = await client.receivingNote.findUnique({
      where: { id: E2E_RN_ID },
      select: { id: true, status: true },
    });
    if (!rn) {
      throw new Error(`E2E fixture invalid: receivingNote missing for receiptNumber=${E2E_RN_RECEIPT_NUMBER} receivingNoteId=${E2E_RN_ID}`);
    }
    if (rn.status !== 'COMPLETED') {
      throw new Error(
        `E2E fixture invalid: receivingNote must be COMPLETED for return-to-supplier (receiptNumber=${E2E_RN_RECEIPT_NUMBER}) gotStatus=${rn.status}`,
      );
    }

    const rnLines = await client.receivingNoteLine.findMany({
      where: { receivingNoteId: E2E_RN_ID },
      select: { id: true, qualifiedQty: true, purchaseOrderLineId: true },
    });
    if (rnLines.length < 1) {
      throw new Error(
        `E2E fixture invalid: receivingNoteLine missing for return-to-supplier (receiptNumber=${E2E_RN_RECEIPT_NUMBER}) linesCount=${rnLines.length}`,
      );
    }

    const eligibleLine = rnLines.find((l) => (l.qualifiedQty ?? 0) >= 1);
    if (!eligibleLine) {
      throw new Error(
        `E2E fixture invalid: receivingNoteLine qualifiedQty must allow return qty=1 (receiptNumber=${E2E_RN_RECEIPT_NUMBER}) qualifiedQtys=${rnLines
          .map((l) => l.qualifiedQty)
          .join(',')}`,
      );
    }

    const alreadyReturnedEvents = await client.inventoryEvent.findMany({
      where: { type: 'RETURN_TO_SUPPLIER', referenceId: eligibleLine.id },
      select: { quantity: true },
    });
    const alreadyReturnedQty = alreadyReturnedEvents.reduce((s, r) => s + Math.abs(r.quantity), 0);
    const remainingReturnableQty = eligibleLine.qualifiedQty - alreadyReturnedQty;
    if (remainingReturnableQty < 1) {
      throw new Error(
        `E2E fixture invalid: receivingNote returnable qty must be >=1 (receiptNumber=${E2E_RN_RECEIPT_NUMBER}) receivingNoteLineId=${eligibleLine.id} qualifiedQty=${eligibleLine.qualifiedQty} alreadyReturned=${alreadyReturnedQty} remainingReturnable=${remainingReturnableQty}`,
      );
    }

    // Ensure related purchaseOrder/warehouse/product exist (avoid UI return flow failure).
    const pl = await client.purchaseOrderLine.findUnique({
      where: { id: eligibleLine.purchaseOrderLineId },
      select: { productId: true, poId: true },
    });
    if (!pl) {
      throw new Error(
        `E2E fixture invalid: purchaseOrderLine missing for receivingNoteLineId=${eligibleLine.id} purchaseOrderLineId=${eligibleLine.purchaseOrderLineId}`,
      );
    }
    const po = await client.purchaseOrder.findUnique({
      where: { id: pl.poId },
      select: { warehouseId: true },
    });
    if (!po) {
      throw new Error(`E2E fixture invalid: purchaseOrder missing for purchaseOrderId=${pl.poId}`);
    }
    const productById = await client.product.findUnique({ where: { id: pl.productId }, select: { id: true } });
    const warehouseById = await client.warehouse.findUnique({ where: { id: po.warehouseId }, select: { id: true } });
    if (!productById || !warehouseById) {
      throw new Error(
        `E2E fixture invalid: product/warehouse missing for receivingNote return-to-supplier (receiptNumber=${E2E_RN_RECEIPT_NUMBER}) productId=${pl.productId} warehouseId=${po.warehouseId}`,
      );
    }

    const singleCount = await client.product.count({ where: { barcode: E2E_BARCODE_SINGLE } });
    if (singleCount !== 1) {
      throw new Error(
        `E2E fixture invalid: barcode single fixture key=${E2E_BARCODE_SINGLE} productCount=${singleCount} (expected 1)`,
      );
    }
    const multiCount = await client.product.count({ where: { barcode: E2E_BARCODE_MULTI } });
    if (multiCount < 2) {
      throw new Error(
        `E2E fixture invalid: barcode multi fixture key=${E2E_BARCODE_MULTI} productCount=${multiCount} (expected >=2)`,
      );
    }
    const [srcOrder, derivedOrder] = await Promise.all([
      client.posOrder.findUnique({ where: { id: E2E_EX_SOURCE_ORDER_ID }, select: { id: true } }),
      client.posOrder.findUnique({ where: { id: E2E_EX_DERIVED_ORDER_ID }, select: { id: true, exchangeFromOrderId: true } }),
    ]);
    if (!srcOrder || !derivedOrder || derivedOrder.exchangeFromOrderId !== E2E_EX_SOURCE_ORDER_ID) {
      throw new Error(
        `E2E fixture invalid: exchange settlement linkage broken expected exchangeFromOrderId=${E2E_EX_SOURCE_ORDER_ID} derivedOrderId=${E2E_EX_DERIVED_ORDER_ID} derived.exchangeFromOrderId=${derivedOrder?.exchangeFromOrderId ?? 'null'}`,
      );
    }
    const refundCount = await client.financeEvent.count({
      where: { referenceId: E2E_EX_SOURCE_ORDER_ID, type: 'SALE_REFUND' },
    });
    if (refundCount < 1) {
      throw new Error(
        `E2E fixture invalid: exchange source order missing financeEvent type=SALE_REFUND referenceId=${E2E_EX_SOURCE_ORDER_ID} count=${refundCount} (expected >=1)`,
      );
    }

    // Ensure `/admin/reports` has at least 1 clickable `ReferenceIdLink` in full profile.
    // Those links must resolve to `posOrder` or `receivingNote` on the backend.
    const financeRefs = await client.financeEvent.findMany({
      where: {
        referenceId: { in: [E2E_ORDER_ID, E2E_RN_ID, E2E_EX_SOURCE_ORDER_ID, E2E_EX_DERIVED_ORDER_ID] },
      },
      select: { referenceId: true, occurredAt: true },
    });
    const distinctRefIds = Array.from(
      new Set(financeRefs.map((r) => (r.referenceId ?? '').trim()).filter((x) => x)),
    );

    if (distinctRefIds.length < 1) {
      throw new Error(
        `E2E fixture invalid: finance referenceId candidates missing referenceIdsExpected=[${[
          E2E_ORDER_ID,
          E2E_RN_ID,
          E2E_EX_SOURCE_ORDER_ID,
          E2E_EX_DERIVED_ORDER_ID,
        ].join(',')}] financeRefsCount=${financeRefs.length}`,
      );
    }

    const [posOrders, receivingNotes] = await Promise.all([
      client.posOrder.findMany({
        where: { id: { in: distinctRefIds } },
        select: { id: true },
      }),
      client.receivingNote.findMany({
        where: { id: { in: distinctRefIds } },
        select: { id: true },
      }),
    ]);

    const posSet = new Set(posOrders.map((o) => o.id));
    const rnSet = new Set(receivingNotes.map((n) => n.id));
    if (posSet.size < 1 && rnSet.size < 1) {
      throw new Error(
        `E2E fixture invalid: no finance referenceId resolvable to posOrder/receivingNote expectedDistinctRefs=[${distinctRefIds.join(
          ',',
        )}] posOrderCount=${posSet.size} receivingNoteCount=${rnSet.size}`,
      );
    }

    // Make `posOrder` referenceId appear before `receivingNote` on `/admin/reports`,
    // because E2E smoke specs click the first `訂單` button.
    const latestPos = await client.financeEvent.findFirst({
      where: { referenceId: { in: [E2E_ORDER_ID, E2E_EX_SOURCE_ORDER_ID] } },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true, referenceId: true },
    });
    const latestRn = await client.financeEvent.findFirst({
      where: { referenceId: E2E_RN_ID },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    if (!latestPos) {
      throw new Error(
        `E2E fixture invalid: missing latest posOrder finance event expectedReferenceIdIn=[${[E2E_ORDER_ID, E2E_EX_SOURCE_ORDER_ID].join(
          ',',
        )}]`,
      );
    }
    if (latestRn && latestPos.occurredAt <= latestRn.occurredAt) {
      throw new Error(
        `E2E fixture invalid: posOrder finance event must be newer than receivingNote referenceId=${E2E_RN_ID} posOccurredAt=${latestPos.occurredAt.toISOString()} receivingNoteOccurredAt=${latestRn.occurredAt.toISOString()}`,
      );
    }

    const reportEventCount = await client.financeEvent.count({ where: { referenceId: E2E_REPORT_SALE_REF } });
    if (reportEventCount < 2) {
      throw new Error(`E2E fixture invalid: finance report sale ref=${E2E_REPORT_SALE_REF} financeEvents count=${reportEventCount} (expected >=2)`);
    }
    const reportPurCount = await client.financeEvent.count({ where: { referenceId: E2E_REPORT_PUR_REF } });
    if (reportPurCount < 2) {
      throw new Error(`E2E fixture invalid: finance report purchase ref=${E2E_REPORT_PUR_REF} financeEvents count=${reportPurCount} (expected >=2)`);
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
      throw new Error(
        `E2E fixture invalid: dispatch enabled rule not runnable name=${E2E_DISPATCH_RULE_ENABLED_NAME} count=${shouldRunCount} (expected>=1)`,
      );
    }

    const disabledCount = await client.crmCouponDispatchRule.count({
      where: { merchantId: merchant.id, name: E2E_DISPATCH_RULE_DISABLED_NAME, enabled: false },
    });
    if (disabledCount < 1) {
      throw new Error(
        `E2E fixture invalid: dispatch disabled rule missing name=${E2E_DISPATCH_RULE_DISABLED_NAME} count=${disabledCount} (expected>=1)`,
      );
    }

    const futureCount = await client.crmCouponDispatchRule.count({
      where: { merchantId: merchant.id, name: E2E_DISPATCH_RULE_FUTURE_NAME, enabled: true, nextRunAt: { gt: new Date() } },
    });
    if (futureCount < 1) {
      throw new Error(
        `E2E fixture invalid: dispatch future rule runnable but should not name=${E2E_DISPATCH_RULE_FUTURE_NAME} count=${futureCount} (expected>=1 but nextRunAt>now)`,
      );
    }
  }

  console.log('E2E seed OK.');
  console.log('Customer id:', E2E_CUSTOMER_ID);
  console.log('POS order id (referenceId):', E2E_ORDER_ID);
  console.log('ReceivingNote id (referenceId):', E2E_RN_ID);
  console.log('Barcode single fixture (q):', E2E_BARCODE_SINGLE);
  if (isFull) {
    console.log('Barcode multi fixture (q):', E2E_BARCODE_MULTI);

    // CI triage: one place to see what deterministic identifiers are expected.
    console.log(
      'E2E_SEED_SUMMARY',
      JSON.stringify({
        E2E_PROFILE: 'full',
        replenishmentSaleRef: E2E_REPLENISH_SALE_REF,
        expiringInventoryBatchCode: E2E_EXPIRING_INVENTORY_BATCH,
        receivingNoteReceiptNumber: E2E_RN_RECEIPT_NUMBER,
        financeReportRefs: { sale: E2E_REPORT_SALE_REF, purchase: E2E_REPORT_PUR_REF },
        dispatchRules: {
          segment: { id: E2E_DISPATCH_SEGMENT_ID, name: E2E_DISPATCH_SEGMENT_NAME },
          coupon: { id: E2E_DISPATCH_COUPON_ID, code: E2E_DISPATCH_COUPON_CODE },
          enabled: { id: E2E_DISPATCH_RULE_ENABLED_ID, name: E2E_DISPATCH_RULE_ENABLED_NAME },
          disabled: { id: E2E_DISPATCH_RULE_DISABLED_ID, name: E2E_DISPATCH_RULE_DISABLED_NAME },
          future: { id: E2E_DISPATCH_RULE_FUTURE_ID, name: E2E_DISPATCH_RULE_FUTURE_NAME },
        },
      }),
    );

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
