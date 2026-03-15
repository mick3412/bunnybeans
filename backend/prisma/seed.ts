/**
 * 完整 DEMO SEED：每次執行先清空業務表再重建，單一可重現劇本。
 * 含：會員／供應商／採購／驗收／庫存／POS／促銷。
 *
 * 警告：會刪除資料庫內既有業務資料。本機還原：migrate reset 或僅執行本 seed。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';

async function wipeAll() {
  await prisma.receivingNoteLine.deleteMany();
  await prisma.receivingNote.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.posOrderPayment.deleteMany();
  await prisma.posOrderItem.deleteMany();
  await prisma.posOrder.deleteMany();
  await prisma.inventoryEvent.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.financeEvent.deleteMany();
  await prisma.bulkImportJob.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.loyaltyCoupon.deleteMany();
  await prisma.loyaltySettings.deleteMany();
  await prisma.promotionRule.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
}

async function main() {
  await wipeAll();
  const now = new Date();
  const y = now.getFullYear();

  const merchant = await prisma.merchant.create({
    data: { code: 'M001', name: 'Demo 商家（完整 SEED）' },
  });
  const store = await prisma.store.create({
    data: { code: 'S001', name: 'Demo 門市', merchantId: merchant.id },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      code: 'W001',
      name: 'Demo 門市倉',
      merchantId: merchant.id,
      storeId: store.id,
    },
  });

  const catClothes = await prisma.category.create({ data: { code: 'cat-clothes', name: '衣服' } });
  const catHay = await prisma.category.create({ data: { code: 'cat-hay', name: '牧草' } });
  const catFeed = await prisma.category.create({ data: { code: 'cat-feed', name: '飼料' } });
  const catSupplies = await prisma.category.create({ data: { code: 'cat-supplies', name: '用品' } });
  const brandHouse = await prisma.brand.create({ data: { code: 'brand-house', name: '自有品牌' } });
  const brandPremium = await prisma.brand.create({ data: { code: 'brand-premium', name: '精選' } });
  const brandFeed = await prisma.brand.create({ data: { code: 'brand-feed', name: '飼料牌' } });

  const pTee = await prisma.product.create({
    data: {
      sku: 'DEMO-TEE-BLK-M',
      name: '經典黑 T M',
      categoryId: catClothes.id,
      brandId: brandHouse.id,
      listPrice: 199,
      salePrice: 150,
      costPrice: 80,
      tags: ['熱銷'],
    },
  });
  const pTeeW = await prisma.product.create({
    data: {
      sku: 'DEMO-TEE-WHT-M',
      name: '經典白 T M',
      categoryId: catClothes.id,
      brandId: brandHouse.id,
      listPrice: 199,
      salePrice: 150,
      costPrice: 80,
      tags: ['熱銷'],
    },
  });
  const pFeed = await prisma.product.create({
    data: {
      sku: 'DEMO-FEED-ADULT',
      name: '成兔飼料 2kg',
      categoryId: catFeed.id,
      brandId: brandFeed.id,
      listPrice: 320,
      salePrice: 280,
      costPrice: 180,
      tags: ['熱銷'],
    },
  });
  const pHay = await prisma.product.create({
    data: {
      sku: 'DEMO-HAY-TIMOTHY',
      name: '提摩西牧草 1kg',
      categoryId: catHay.id,
      brandId: brandHouse.id,
      listPrice: 180,
      salePrice: 150,
      costPrice: 90,
      tags: [],
    },
  });
  const pBowl = await prisma.product.create({
    data: {
      sku: 'DEMO-BOWL-S',
      name: '食盆 小',
      categoryId: catSupplies.id,
      brandId: brandHouse.id,
      listPrice: 120,
      salePrice: 99,
      costPrice: 45,
      tags: [],
    },
  });
  const pLowStock = await prisma.product.create({
    data: {
      sku: 'DEMO-LOW-STOCK',
      name: '低庫存測試品',
      categoryId: catSupplies.id,
      brandId: brandHouse.id,
      salePrice: 50,
      tags: [],
    },
  });
  const pZeroStock = await prisma.product.create({
    data: {
      sku: 'DEMO-ZERO-STOCK',
      name: '零庫存測試品',
      categoryId: catClothes.id,
      brandId: brandPremium.id,
      salePrice: 399,
      tags: ['清倉'],
    },
  });

  /** 會員／客戶：E2E 固定 id + 多樣等級／入會日／有無訂單／點數情境（見 db-seed.md） */
  const join = (yOff: number, m: number, d: number) => new Date(y - yOff, m, d);
  await prisma.customer.create({
    data: {
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
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'VIP001',
      name: '林大戶',
      phone: '0911111111',
      email: 'vip@demo.local',
      memberLevel: 'VIP',
      memberCode: 'M001',
      joinDate: join(3, 2, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'VIP002',
      name: '陳金卡',
      phone: '0922222222',
      memberLevel: 'GOLD',
      memberCode: 'M002',
      joinDate: join(2, 5, 10),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM001',
      name: '王一般',
      phone: '0933333333',
      memberLevel: 'NORMAL',
      memberCode: 'M003',
      joinDate: join(1, 8, 20),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM002',
      name: '張小白',
      phone: '0944444444',
      email: 'zhang@demo.local',
      memberLevel: 'NORMAL',
      memberCode: 'M004',
      joinDate: join(1, 3, 5),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM003',
      name: '劉新客（本週入會）',
      phone: '0955555555',
      memberLevel: 'NORMAL',
      memberCode: 'M005',
      joinDate: new Date(now.getTime() - 5 * 86400000),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM004',
      name: '黃零點（尚無消費）',
      phone: '0966666666',
      memberLevel: 'NORMAL',
      memberCode: 'M006',
      joinDate: join(1, 0, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM005',
      name: '吳多筆（三筆訂單）',
      phone: '0977777777',
      memberLevel: 'VIP',
      memberCode: 'M007',
      joinDate: join(1, 6, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM006',
      name: '鄭折抵（曾兌點）',
      phone: '0988888888',
      memberLevel: 'GOLD',
      memberCode: 'M008',
      joinDate: join(0, 9, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'WALK01',
      name: '路過客（無電話）',
      phone: null,
      memberLevel: null,
      memberCode: null,
      joinDate: null,
    },
  });

  const supActive1 = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-大和紡織',
      name: '大和紡織股份有限公司',
      contactPerson: '陳志明',
      phone: '02-2345-6789',
      paymentTerms: '月結30天',
      status: 'ACTIVE',
      email: 'chen@dahe-textile.com',
      taxId: '12345678',
      address: '台北市中山區南京東路三段100號',
    },
  });
  const supActive2 = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-宏達成衣',
      name: '宏達成衣廠',
      contactPerson: '林美玲',
      phone: '04-2234-5678',
      paymentTerms: '月結45天',
      status: 'ACTIVE',
    },
  });
  const supInactive = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-停用廠商',
      name: '已停用供應商',
      status: 'INACTIVE',
      paymentTerms: '貨到付款',
    },
  });
  const supActive3 = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-永豐配件',
      name: '永豐配件貿易',
      contactPerson: '王建國',
      phone: '03-3345-6789',
      paymentTerms: '貨到付款',
      status: 'ACTIVE',
    },
  });

  async function addBalance(productId: string, qty: number, ref: string, note: string, at: Date) {
    await prisma.inventoryEvent.create({
      data: {
        productId,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: qty,
        occurredAt: at,
        referenceId: ref,
        note,
      },
    });
    await prisma.inventoryBalance.create({
      data: { productId, warehouseId: warehouse.id, onHandQty: qty },
    });
  }

  /** 1) PO DRAFT */
  await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive1.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-DRAFT`,
      status: 'DRAFT',
      expectedDate: new Date(y, 5, 1),
      lines: {
        create: [
          { productId: pTee.id, qtyOrdered: 100, unitCost: 80 },
          { productId: pTeeW.id, qtyOrdered: 80, unitCost: 80 },
        ],
      },
    },
  });

  /** 2) PO CANCELLED（曾草稿後取消） */
  await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supInactive.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-CANCEL`,
      status: 'CANCELLED',
      lines: { create: [{ productId: pBowl.id, qtyOrdered: 20, unitCost: 45 }] },
    },
  });

  /** 3) PO ORDERED — 未驗收，供「新增驗收單」 */
  const poOrderedOnly = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive2.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-ORDERED`,
      status: 'ORDERED',
      orderDate: new Date(y, 1, 10),
      expectedDate: new Date(y, 2, 25),
      lines: {
        create: [{ productId: pHay.id, qtyOrdered: 50, unitCost: 90 }],
      },
    },
    include: { lines: true },
  });

  /** 4) 另建一張 ORDERED 單掛 RN PENDING（待驗收）— 與 (3) 分開避免同一 PO 多張 RN 混淆 */
  const poPendingParent = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive2.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-PEND-PO`,
      status: 'ORDERED',
      orderDate: new Date(y, 1, 12),
      lines: { create: [{ productId: pHay.id, qtyOrdered: 30, unitCost: 90 }] },
    },
    include: { lines: true },
  });
  const polPending = poPendingParent.lines[0];
  await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-PENDING`,
      purchaseOrderId: poPendingParent.id,
      inspectorName: '待指派',
      status: 'PENDING',
      lines: {
        create: [
          {
            purchaseOrderLineId: polPending.id,
            orderedQty: 50,
            receivedQty: 0,
            qualifiedQty: 0,
            returnedQty: 0,
          },
        ],
      },
    },
  });

  /** 5) PO ORDERED 多行 + RN IN_PROGRESS（部分填寫） */
  const poProgress = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive3.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-PROGRESS`,
      status: 'ORDERED',
      orderDate: new Date(y, 2, 5),
      expectedDate: new Date(y, 2, 20),
      lines: {
        create: [
          { productId: pBowl.id, qtyOrdered: 200, unitCost: 45 },
          { productId: pHay.id, qtyOrdered: 30, unitCost: 90 },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-INPROG`,
      purchaseOrderId: poProgress.id,
      inspectorName: '倉管-王大明',
      status: 'IN_PROGRESS',
      inspectionDate: new Date(y, 2, 18),
      lines: {
        create: [
          {
            purchaseOrderLineId: poProgress.lines[0].id,
            orderedQty: 200,
            receivedQty: 120,
            qualifiedQty: 0,
            returnedQty: 0,
          },
          {
            purchaseOrderLineId: poProgress.lines[1].id,
            orderedQty: 30,
            receivedQty: 30,
            qualifiedQty: 0,
            returnedQty: 0,
          },
        ],
      },
    },
  });

  /** 6) PO 全收滿 RECEIVED + RN COMPLETED（與入庫一致）— 短袖黑T 100、白T 80 */
  const poFull = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive1.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-FULL`,
      status: 'ORDERED',
      orderDate: new Date(y, 1, 10),
      expectedDate: new Date(y, 1, 20),
      lines: {
        create: [
          { productId: pTee.id, qtyOrdered: 100, qtyReceived: 100, unitCost: 80 },
          { productId: pTeeW.id, qtyOrdered: 80, qtyReceived: 80, unitCost: 80 },
        ],
      },
    },
    include: { lines: true },
  });
  const rnFull = await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-FULL`,
      purchaseOrderId: poFull.id,
      inspectorName: '倉管-李小華',
      status: 'COMPLETED',
      inspectionDate: new Date(y, 1, 20),
      remark: '全數合格',
      lines: {
        create: [
          {
            purchaseOrderLineId: poFull.lines[0].id,
            orderedQty: 100,
            receivedQty: 100,
            qualifiedQty: 100,
            returnedQty: 0,
          },
          {
            purchaseOrderLineId: poFull.lines[1].id,
            orderedQty: 80,
            receivedQty: 80,
            qualifiedQty: 80,
            returnedQty: 0,
          },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.purchaseOrder.update({
    where: { id: poFull.id },
    data: { status: 'RECEIVED' },
  });
  const tFull = new Date(y, 1, 20, 10, 0);
  await addBalance(pTee.id, 100, rnFull.lines[0].id, '驗收 DEMO-RN-FULL 合格入庫', tFull);
  await addBalance(pTeeW.id, 80, rnFull.lines[1].id, '驗收 DEMO-RN-FULL 合格入庫', tFull);
  /** 與驗收 complete 相同：一筆可對帳 PURCHASE_PAYABLE（referenceId = RN id） */
  const payableFull =
    Math.round((100 * 80 + 80 * 80) * 100) / 100;
  await prisma.financeEvent.create({
    data: {
      type: 'PURCHASE_PAYABLE',
      partyId: supActive1.id,
      currency: 'TWD',
      amount: payableFull,
      taxAmount: 0,
      occurredAt: tFull,
      referenceId: rnFull.id,
      note: `PURCHASE_PAYABLE RN ${rnFull.receiptNumber} (seed)`,
    },
  });

  /** 7) PARTIALLY_RECEIVED：飼料訂 40，先收 15 合格入庫 */
  const poPartial = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive2.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-PARTIAL`,
      status: 'ORDERED',
      orderDate: new Date(y, 2, 1),
      lines: {
        create: [{ productId: pFeed.id, qtyOrdered: 40, qtyReceived: 15, unitCost: 180 }],
      },
    },
    include: { lines: true },
  });
  const rnPartial = await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-PARTIAL`,
      purchaseOrderId: poPartial.id,
      inspectorName: '倉管-李小華',
      status: 'COMPLETED',
      inspectionDate: new Date(y, 2, 15),
      lines: {
        create: [
          {
            purchaseOrderLineId: poPartial.lines[0].id,
            orderedQty: 40,
            receivedQty: 20,
            qualifiedQty: 15,
            returnedQty: 5,
            returnReason: '包裝破損',
          },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.purchaseOrder.update({
    where: { id: poPartial.id },
    data: { status: 'PARTIALLY_RECEIVED' },
  });
  await addBalance(pFeed.id, 15, rnPartial.lines[0].id, '部分驗收合格入庫', new Date(y, 2, 15));

  /** 8) RN RETURNED（整單退回，不入庫） */
  const poReturn = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive3.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-RETURN`,
      status: 'ORDERED',
      orderDate: new Date(y, 0, 1),
      lines: { create: [{ productId: pZeroStock.id, qtyOrdered: 10, unitCost: 100 }] },
    },
    include: { lines: true },
  });
  await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-RETURNED`,
      purchaseOrderId: poReturn.id,
      inspectorName: '倉管-王大明',
      status: 'RETURNED',
      remark: '整批退貨',
      lines: {
        create: [
          {
            purchaseOrderLineId: poReturn.lines[0].id,
            orderedQty: 10,
            receivedQty: 0,
            qualifiedQty: 0,
            returnedQty: 0,
          },
        ],
      },
    },
  });

  /** 其餘商品初始庫存（無採購鏈的補滿） */
  const t0 = new Date(y, 0, 1);
  await addBalance(pHay.id, 120, 'SEED-BULK', '初始補貨（含多筆 POS 扣庫）', t0);
  await addBalance(pBowl.id, 120, 'SEED-BULK', '初始補貨（含多筆 POS 扣庫）', t0);
  await addBalance(pLowStock.id, 1, 'SEED-EDGE', '低庫存', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pZeroStock.id, warehouseId: warehouse.id, onHandQty: 0 },
  });

  /** POS 訂單 + SALE_OUT */
  const custVip = await prisma.customer.findFirst({
    where: { merchantId: merchant.id, code: 'VIP001' },
  });
  const order1 = await prisma.posOrder.create({
    data: {
      orderNumber: `DEMO-POS-${y}-001`,
      storeId: store.id,
      customerId: custVip!.id,
      subtotalAmount: 300,
      discountAmount: 10,
      totalAmount: 290,
      items: {
        create: [{ productId: pTee.id, quantity: 2, unitPrice: 150 }],
      },
    },
    include: { items: true },
  });
  await prisma.posOrderPayment.create({
    data: { orderId: order1.id, method: 'CASH', amount: 290 },
  });
  await prisma.inventoryEvent.create({
    data: {
      productId: pTee.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: -2,
      occurredAt: new Date(y, 2, 1),
      referenceId: order1.id,
      note: 'POS DEMO-POS-001',
    },
  });
  await prisma.inventoryBalance.update({
    where: {
      productId_warehouseId: { productId: pTee.id, warehouseId: warehouse.id },
    },
    data: { onHandQty: { decrement: 2 } },
  });
  await prisma.loyaltySettings.create({ data: { merchantId: merchant.id } });
  await prisma.loyaltyCoupon.create({
    data: {
      merchantId: merchant.id,
      code: 'WELCOME10',
      name: '新會員折 10 元',
      discountType: 'FIXED',
      value: 10,
      active: true,
    },
  });

  const c = async (code: string) =>
    prisma.customer.findFirstOrThrow({ where: { merchantId: merchant.id, code } });
  async function posSale(args: {
    orderNumber: string;
    customerId: string;
    subtotal: number;
    discount: number;
    total: number;
    method: string;
    occurredAt: Date;
    lines: { productId: string; qty: number; unitPrice: number }[];
    note: string;
  }) {
    const order = await prisma.posOrder.create({
      data: {
        orderNumber: args.orderNumber,
        storeId: store.id,
        customerId: args.customerId,
        subtotalAmount: args.subtotal,
        discountAmount: args.discount,
        totalAmount: args.total,
        items: {
          create: args.lines.map((l) => ({
            productId: l.productId,
            quantity: l.qty,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });
    await prisma.posOrderPayment.create({
      data: { orderId: order.id, method: args.method, amount: args.total },
    });
    for (const l of args.lines) {
      await prisma.inventoryEvent.create({
        data: {
          productId: l.productId,
          warehouseId: warehouse.id,
          type: 'SALE_OUT',
          quantity: -l.qty,
          occurredAt: args.occurredAt,
          referenceId: order.id,
          note: args.note,
        },
      });
      await prisma.inventoryBalance.update({
        where: {
          productId_warehouseId: { productId: l.productId, warehouseId: warehouse.id },
        },
        data: { onHandQty: { decrement: l.qty } },
      });
    }
    return order;
  }
  const custGold = await c('VIP002');
  const custMem1 = await c('MEM001');
  const custMem2 = await c('MEM002');
  const custMem3 = await c('MEM003');
  const custMem5 = await c('MEM005');
  const custMem6 = await c('MEM006');
  const order1b = await posSale({
    orderNumber: `DEMO-POS-${y}-003`,
    customerId: custVip!.id,
    subtotal: 450,
    discount: 0,
    total: 450,
    method: 'CASH',
    occurredAt: new Date(y, 2, 10, 14, 30),
    lines: [{ productId: pTeeW.id, qty: 3, unitPrice: 150 }],
    note: 'POS DEMO-POS-003 林大戶第二筆',
  });
  const orderGold = await posSale({
    orderNumber: `DEMO-POS-${y}-004`,
    customerId: custGold.id,
    subtotal: 300,
    discount: 0,
    total: 300,
    method: 'CASH',
    occurredAt: new Date(y, 2, 3, 10, 0),
    lines: [{ productId: pTee.id, qty: 2, unitPrice: 150 }],
    note: 'POS DEMO-POS-004 陳金卡',
  });
  const orderMem1a = await posSale({
    orderNumber: `DEMO-POS-${y}-005`,
    customerId: custMem1.id,
    subtotal: 198,
    discount: 0,
    total: 198,
    method: 'CASH',
    occurredAt: new Date(y, 2, 4, 9, 0),
    lines: [{ productId: pBowl.id, qty: 2, unitPrice: 99 }],
    note: 'POS DEMO-POS-005 王一般',
  });
  const orderMem1b = await posSale({
    orderNumber: `DEMO-POS-${y}-006`,
    customerId: custMem1.id,
    subtotal: 150,
    discount: 0,
    total: 150,
    method: 'CASH',
    occurredAt: new Date(y, 2, 5, 16, 0),
    lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }],
    note: 'POS DEMO-POS-006 王一般',
  });
  const orderMem2 = await posSale({
    orderNumber: `DEMO-POS-${y}-007`,
    customerId: custMem2.id,
    subtotal: 300,
    discount: 0,
    total: 300,
    method: 'CASH',
    occurredAt: new Date(y, 2, 6, 12, 0),
    lines: [{ productId: pTeeW.id, qty: 2, unitPrice: 150 }],
    note: 'POS DEMO-POS-007 張小白',
  });
  const orderMem3 = await posSale({
    orderNumber: `DEMO-POS-${y}-008`,
    customerId: custMem3.id,
    subtotal: 280,
    discount: 0,
    total: 280,
    method: 'CASH',
    occurredAt: new Date(y, 2, 7, 13, 0),
    lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }],
    note: 'POS DEMO-POS-008 劉新客',
  });
  const orderMem5a = await posSale({
    orderNumber: `DEMO-POS-${y}-009`,
    customerId: custMem5.id,
    subtotal: 150,
    discount: 0,
    total: 150,
    method: 'CASH',
    occurredAt: new Date(y, 1, 5, 10, 0),
    lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }],
    note: 'POS DEMO-POS-009 吳多筆',
  });
  const orderMem5b = await posSale({
    orderNumber: `DEMO-POS-${y}-010`,
    customerId: custMem5.id,
    subtotal: 199,
    discount: 0,
    total: 199,
    method: 'CASH',
    occurredAt: new Date(y, 1, 12, 11, 0),
    lines: [
      { productId: pHay.id, qty: 1, unitPrice: 150 },
      { productId: pBowl.id, qty: 1, unitPrice: 49 },
    ],
    note: 'POS DEMO-POS-010 吳多筆',
  });
  const orderMem5c = await posSale({
    orderNumber: `DEMO-POS-${y}-011`,
    customerId: custMem5.id,
    subtotal: 320,
    discount: 20,
    total: 300,
    method: 'CASH',
    occurredAt: new Date(y, 2, 8, 15, 0),
    lines: [{ productId: pFeed.id, qty: 1, unitPrice: 320 }],
    note: 'POS DEMO-POS-011 吳多筆',
  });
  const orderMem6 = await posSale({
    orderNumber: `DEMO-POS-${y}-012`,
    customerId: custMem6.id,
    subtotal: 400,
    discount: 0,
    total: 400,
    method: 'CASH',
    occurredAt: new Date(y, 2, 9, 10, 0),
    lines: [
      { productId: pTee.id, qty: 2, unitPrice: 150 },
      { productId: pBowl.id, qty: 1, unitPrice: 100 },
    ],
    note: 'POS DEMO-POS-012 鄭折抵',
  });
  const order2 = await posSale({
    orderNumber: `DEMO-POS-${y}-002`,
    customerId: E2E_CUSTOMER_ID,
    subtotal: 280,
    discount: 0,
    total: 280,
    method: 'CREDIT',
    occurredAt: new Date(y, 2, 2, 17, 0),
    lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }],
    note: 'POS DEMO-POS-002 E2E 賒帳',
  });
  const ledgerRows: {
    customerId: string;
    type: 'EARNED' | 'BURNED' | 'EXPIRED';
    amount: number;
    balanceAfter: number;
    referenceId: string | null;
    note: string;
    createdAt: Date;
  }[] = [
    {
      customerId: custVip!.id,
      type: 'EARNED',
      amount: 2,
      balanceAfter: 2,
      referenceId: order1.id,
      note: `贈點 ${order1.orderNumber}`,
      createdAt: new Date(y, 2, 1, 11, 1),
    },
    {
      customerId: custVip!.id,
      type: 'EARNED',
      amount: 4,
      balanceAfter: 6,
      referenceId: order1b.id,
      note: `贈點 ${order1b.orderNumber}`,
      createdAt: new Date(y, 2, 10, 14, 31),
    },
    {
      customerId: custGold.id,
      type: 'EARNED',
      amount: 3,
      balanceAfter: 3,
      referenceId: orderGold.id,
      note: `贈點 ${orderGold.orderNumber}`,
      createdAt: new Date(y, 2, 3, 10, 1),
    },
    {
      customerId: custGold.id,
      type: 'BURNED',
      amount: 2,
      balanceAfter: 1,
      referenceId: null,
      note: '結帳折抵 2 點（seed）',
      createdAt: new Date(y, 2, 4, 9, 0),
    },
    {
      customerId: custMem1.id,
      type: 'EARNED',
      amount: 1,
      balanceAfter: 1,
      referenceId: orderMem1a.id,
      note: `贈點 ${orderMem1a.orderNumber}`,
      createdAt: new Date(y, 2, 4, 9, 1),
    },
    {
      customerId: custMem1.id,
      type: 'EARNED',
      amount: 1,
      balanceAfter: 2,
      referenceId: orderMem1b.id,
      note: `贈點 ${orderMem1b.orderNumber}`,
      createdAt: new Date(y, 2, 5, 16, 1),
    },
    {
      customerId: custMem2.id,
      type: 'EARNED',
      amount: 3,
      balanceAfter: 3,
      referenceId: orderMem2.id,
      note: `贈點 ${orderMem2.orderNumber}`,
      createdAt: new Date(y, 2, 6, 12, 1),
    },
    {
      customerId: custMem3.id,
      type: 'EARNED',
      amount: 2,
      balanceAfter: 2,
      referenceId: orderMem3.id,
      note: `贈點 ${orderMem3.orderNumber}`,
      createdAt: new Date(y, 2, 7, 13, 1),
    },
    {
      customerId: custMem5.id,
      type: 'EARNED',
      amount: 1,
      balanceAfter: 1,
      referenceId: orderMem5a.id,
      note: `贈點 ${orderMem5a.orderNumber}`,
      createdAt: new Date(y, 1, 5, 10, 1),
    },
    {
      customerId: custMem5.id,
      type: 'EARNED',
      amount: 1,
      balanceAfter: 2,
      referenceId: orderMem5b.id,
      note: `贈點 ${orderMem5b.orderNumber}`,
      createdAt: new Date(y, 1, 12, 11, 1),
    },
    {
      customerId: custMem5.id,
      type: 'EARNED',
      amount: 3,
      balanceAfter: 5,
      referenceId: orderMem5c.id,
      note: `贈點 ${orderMem5c.orderNumber}`,
      createdAt: new Date(y, 2, 8, 15, 1),
    },
    {
      customerId: custMem5.id,
      type: 'EXPIRED',
      amount: 1,
      balanceAfter: 4,
      referenceId: null,
      note: '效期到期沖銷 1 點（seed 示範）',
      createdAt: new Date(y, 2, 9, 8, 0),
    },
    {
      customerId: custMem6.id,
      type: 'EARNED',
      amount: 4,
      balanceAfter: 4,
      referenceId: orderMem6.id,
      note: `贈點 ${orderMem6.orderNumber}`,
      createdAt: new Date(y, 2, 9, 10, 1),
    },
    {
      customerId: custMem6.id,
      type: 'BURNED',
      amount: 3,
      balanceAfter: 1,
      referenceId: null,
      note: '兌換折 3 點（seed）',
      createdAt: new Date(y, 2, 9, 11, 0),
    },
    {
      customerId: E2E_CUSTOMER_ID,
      type: 'EARNED',
      amount: 2,
      balanceAfter: 2,
      referenceId: order2.id,
      note: `贈點 ${order2.orderNumber}`,
      createdAt: new Date(y, 2, 2, 17, 1),
    },
  ];
  for (const row of ledgerRows) {
    await prisma.pointLedger.create({
      data: {
        merchantId: merchant.id,
        customerId: row.customerId,
        type: row.type,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        txnCode: row.type === 'EARNED' ? 'SALE' : row.type,
        referenceId: row.referenceId,
        note: row.note,
        createdAt: row.createdAt,
      },
    });
  }

  const yearStart = new Date(y, 0, 1);
  const yearEnd = new Date(y, 11, 31, 23, 59, 59);
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: 'E2E 滿百折十（小計100→折10）',
      priority: 2,
      draft: false,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [{ type: 'SPEND', op: '>=', value: 100 }],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 10 }],
    },
  });
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: '全館滿千折百',
      priority: 1,
      draft: false,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [{ type: 'SPEND', op: '>=', value: 1000 }],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 100 }],
    },
  });
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: '草稿促銷（未上架）',
      priority: 99,
      draft: true,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 5 }],
    },
  });

  await prisma.bulkImportJob.create({
    data: {
      kind: 'products_csv',
      status: 'done',
      resultJson: JSON.stringify({ ok: 3, failed: 0 }),
    },
  });
  await prisma.bulkImportJob.create({
    data: {
      kind: 'inventory_csv',
      status: 'failed',
      error: 'CSV 欄位 sku 缺漏',
      resultJson: null,
    },
  });

  console.log('Seed OK (wipe + full demo). Merchant', merchant.code);
  console.log('Customers:', await prisma.customer.count(), '| Suppliers:', await prisma.supplier.count());
  console.log(
    'PO by status:',
    await prisma.purchaseOrder.groupBy({ by: ['status'], _count: { _all: true } }),
  );
  console.log(
    'RN by status:',
    await prisma.receivingNote.groupBy({ by: ['status'], _count: { _all: true } }),
  );
  console.log('E2E customer id:', E2E_CUSTOMER_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
