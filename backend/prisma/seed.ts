/**
 * 完整 DEMO SEED：每次執行先清空業務表再重建，單一可重現劇本。
 * 含：商品（含重量／規格／款式／效期）、會員／供應商／採購／驗收／庫存／POS／促銷／分群／發券。
 * 數據量較大，符合商品、會員、促銷、銷售、報表各層級測試需求。
 *
 * 警告：會刪除資料庫內既有業務資料。本機還原：migrate reset 或僅執行本 seed。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wipeAll() {
  await prisma.loyaltyCouponIssue.deleteMany();
  await prisma.crmCouponDispatchRule.deleteMany();
  await prisma.crmMarketingJob.deleteMany();
  await prisma.tierRule.deleteMany();
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
  await prisma.financePeriodClose.deleteMany();
  await prisma.financeAuditLog.deleteMany();
  await prisma.financeSnapshot.deleteMany();
  await prisma.reportClickAudit.deleteMany();
  await prisma.opsJobRunLog.deleteMany();
  await prisma.bulkImportJob.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.loyaltyCoupon.deleteMany();
  await prisma.loyaltySettings.deleteMany();
  await prisma.promotionRule.deleteMany();
  await prisma.customerContactLog.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.store.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
}

async function main() {
  await wipeAll();
  const now = new Date();
  const y = now.getFullYear();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

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

  const catClothes = await prisma.category.create({ data: { code: 'cat-clothes', name: '衣服', sortOrder: 0 } });
  const catHay = await prisma.category.create({ data: { code: 'cat-hay', name: '牧草', sortOrder: 1 } });
  const catFeed = await prisma.category.create({ data: { code: 'cat-feed', name: '飼料', sortOrder: 2 } });
  const catSupplies = await prisma.category.create({ data: { code: 'cat-supplies', name: '用品', sortOrder: 3 } });
  const catSnacks = await prisma.category.create({ data: { code: 'cat-snacks', name: '零食', sortOrder: 4 } });
  const catToys = await prisma.category.create({ data: { code: 'cat-toys', name: '玩具', sortOrder: 5 } });
  const brandHouse = await prisma.brand.create({ data: { code: 'brand-house', name: '品牌A', sortOrder: 0 } });
  const brandPremium = await prisma.brand.create({ data: { code: 'brand-premium', name: '品牌B', sortOrder: 1 } });
  const brandFeed = await prisma.brand.create({ data: { code: 'brand-feed', name: '品牌C', sortOrder: 2 } });
  const brandImport = await prisma.brand.create({ data: { code: 'brand-import', name: '品牌D', sortOrder: 3 } });

  const productData = [
    { sku: 'DEMO-TEE-BLK-M', name: '經典黑 T M', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'M', specStyle: '圓領', specWeight: '180g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-BLK-L', name: '經典黑 T L', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'L', specStyle: '圓領', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-WHT-M', name: '經典白 T M', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'M', specStyle: '圓領', specWeight: '175g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-WHT-L', name: '經典白 T L', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: [], specSize: 'L', specStyle: '圓領', specWeight: '195g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-GRY-S', name: '經典灰 T S', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['新品'], specSize: 'S', specStyle: '圓領', specWeight: '160g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-FEED-ADULT', name: '成兔飼料 2kg', cat: catFeed, brand: brandFeed, list: 320, sale: 280, cost: 180, tags: ['熱銷'], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '常溫 12 個月' },
    { sku: 'DEMO-FEED-JR', name: '幼兔飼料 1kg', cat: catFeed, brand: brandFeed, list: 200, sale: 179, cost: 100, tags: [], specSize: null, specStyle: null, specWeight: '1kg', specCapacity: null, expiryDescription: '常溫 12 個月' },
    { sku: 'DEMO-FEED-SENIOR', name: '高齡兔飼料 2kg', cat: catFeed, brand: brandFeed, list: 380, sale: 340, cost: 200, tags: [], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '常溫 10 個月' },
    { sku: 'DEMO-HAY-TIMOTHY', name: '提摩西牧草 1kg', cat: catHay, brand: brandHouse, list: 180, sale: 150, cost: 90, tags: ['熱銷'], specSize: null, specStyle: null, specWeight: '1kg', specCapacity: null, expiryDescription: '乾燥保存 6 個月' },
    { sku: 'DEMO-HAY-ALFALFA', name: '苜蓿牧草 500g', cat: catHay, brand: brandHouse, list: 120, sale: 99, cost: 50, tags: [], specSize: null, specStyle: null, specWeight: '500g', specCapacity: null, expiryDescription: '乾燥保存 6 個月' },
    { sku: 'DEMO-HAY-MIX', name: '綜合牧草 2kg', cat: catHay, brand: brandPremium, list: 350, sale: 299, cost: 160, tags: [], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '乾燥保存 6 個月' },
    { sku: 'DEMO-BOWL-S', name: '食盆 小', cat: catSupplies, brand: brandHouse, list: 120, sale: 99, cost: 45, tags: [], specSize: 'S', specStyle: '圓形', specWeight: '80g', specCapacity: '200ml', expiryDescription: null },
    { sku: 'DEMO-BOWL-M', name: '食盆 中', cat: catSupplies, brand: brandHouse, list: 180, sale: 149, cost: 65, tags: [], specSize: 'M', specStyle: '圓形', specWeight: '150g', specCapacity: '400ml', expiryDescription: null },
    { sku: 'DEMO-BOWL-L', name: '食盆 大', cat: catSupplies, brand: brandHouse, list: 250, sale: 199, cost: 90, tags: [], specSize: 'L', specStyle: '圓形', specWeight: '280g', specCapacity: '800ml', expiryDescription: null },
    { sku: 'DEMO-BOTTLE-350', name: '滾珠水壺 350ml', cat: catSupplies, brand: brandHouse, list: 150, sale: 129, cost: 55, tags: [], specSize: null, specStyle: '滾珠', specWeight: '120g', specCapacity: '350ml', expiryDescription: null },
    { sku: 'DEMO-BOTTLE-600', name: '滾珠水壺 600ml', cat: catSupplies, brand: brandPremium, list: 220, sale: 189, cost: 85, tags: [], specSize: null, specStyle: '滾珠', specWeight: '180g', specCapacity: '600ml', expiryDescription: null },
    { sku: 'DEMO-LOW-STOCK', name: '低庫存測試品', cat: catSupplies, brand: brandHouse, list: 50, sale: 50, cost: 20, tags: ['清倉'], specSize: 'S', specStyle: '標準', specWeight: '50g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-ZERO-STOCK', name: '零庫存測試品', cat: catClothes, brand: brandPremium, list: 399, sale: 399, cost: 150, tags: ['清倉'], specSize: 'M', specStyle: '限量款', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-SNACK-CARROT', name: '胡蘿蔔乾 50g', cat: catSnacks, brand: brandHouse, list: 80, sale: 65, cost: 25, tags: [], specSize: null, specStyle: null, specWeight: '50g', specCapacity: null, expiryDescription: '常溫 3 個月' },
    { sku: 'DEMO-SNACK-APPLE', name: '蘋果片 30g', cat: catSnacks, brand: brandPremium, list: 60, sale: 49, cost: 18, tags: ['新品'], specSize: null, specStyle: null, specWeight: '30g', specCapacity: null, expiryDescription: '常溫 2 個月' },
    { sku: 'DEMO-TOY-BALL', name: '草球玩具', cat: catToys, brand: brandHouse, list: 89, sale: 75, cost: 30, tags: [], specSize: '直徑 8cm', specStyle: '圓球', specWeight: '40g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TOY-TUNNEL', name: '隧道玩具', cat: catToys, brand: brandPremium, list: 299, sale: 249, cost: 100, tags: [], specSize: '長 60cm', specStyle: '可折疊', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-CAGE-S', name: '兔籠 S 號', cat: catSupplies, brand: brandImport, list: 1299, sale: 1099, cost: 500, tags: [], specSize: 'S', specStyle: '單層', specWeight: '3kg', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-CAGE-L', name: '兔籠 L 號', cat: catSupplies, brand: brandImport, list: 1999, sale: 1699, cost: 750, tags: ['熱銷'], specSize: 'L', specStyle: '雙層', specWeight: '5kg', specCapacity: null, expiryDescription: null },
  ];
  const products: Record<string, Awaited<ReturnType<typeof prisma.product.create>>> = {} as any;
  for (const p of productData) {
    const created = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        categoryId: p.cat.id,
        brandId: p.brand.id,
        listPrice: p.list,
        salePrice: p.sale,
        costPrice: p.cost,
        tags: p.tags,
        specSize: p.specSize ?? undefined,
        specStyle: p.specStyle ?? undefined,
        specWeight: p.specWeight ?? undefined,
        specCapacity: p.specCapacity ?? undefined,
        expiryDescription: p.expiryDescription ?? undefined,
      },
    });
    products[p.sku] = created;
  }
  const pTee = products['DEMO-TEE-BLK-M'];
  const pTeeW = products['DEMO-TEE-WHT-M'];
  const pFeed = products['DEMO-FEED-ADULT'];
  const pHay = products['DEMO-HAY-TIMOTHY'];
  const pBowl = products['DEMO-BOWL-S'];
  const pLowStock = products['DEMO-LOW-STOCK'];
  const pZeroStock = products['DEMO-ZERO-STOCK'];

  /** ProductTag：商品標籤示範，供前端類別管理／商品頁選用 */
  await prisma.productTag.create({
    data: { merchantId: merchant.id, code: 'SEED-TAG-HOT', name: '熱銷', sortOrder: 0 },
  });
  await prisma.productTag.create({
    data: { merchantId: merchant.id, code: 'SEED-TAG-NEW', name: '新品', sortOrder: 1 },
  });
  await prisma.productTag.create({
    data: { merchantId: merchant.id, code: 'SEED-TAG-CLEARANCE', name: '清倉', sortOrder: 2 },
  });

  /** 會員／客戶：多樣等級／入會日／有無訂單／點數情境（見 db-seed.md）；E2E 客戶由 e2e-seed 建立 */
  const join = (yOff: number, m: number, d: number) => new Date(y - yOff, m, d);
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

  /** 更多會員 dummy（供會員管理列表／搜尋／篩選測試；多數無訂單） */
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM007',
      name: '趙測試',
      phone: '0910001001',
      email: 'zhao@demo.local',
      memberLevel: 'NORMAL',
      memberCode: 'M009',
      joinDate: new Date(now.getTime() - 2 * 86400000),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM008',
      name: '孫銀卡',
      phone: '0910002002',
      memberLevel: 'GOLD',
      memberCode: 'M010',
      joinDate: join(0, 10, 15),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM009',
      name: '周常客',
      phone: '0910003003',
      memberLevel: 'NORMAL',
      memberCode: 'M011',
      joinDate: join(1, 1, 20),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM010',
      name: '吳小惠',
      phone: '0910004004',
      email: 'wu@demo.local',
      memberLevel: 'VIP',
      memberCode: 'M012',
      joinDate: join(0, 7, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM011',
      name: '馮新友',
      phone: '0910005005',
      memberLevel: 'NORMAL',
      memberCode: 'M013',
      joinDate: new Date(now.getTime() - 14 * 86400000),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM012',
      name: '陳大點',
      phone: '0910006006',
      memberLevel: 'GOLD',
      memberCode: 'M014',
      joinDate: join(0, 4, 10),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM013',
      name: '林小芳',
      phone: '0910007007',
      email: 'lin.xiao@demo.local',
      memberLevel: 'NORMAL',
      memberCode: 'M015',
      joinDate: join(1, 11, 5),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM014',
      name: '許匿名',
      phone: null,
      memberLevel: 'NORMAL',
      memberCode: 'M016',
      joinDate: join(0, 6, 20),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM015',
      name: '高回購',
      phone: '0910008008',
      memberLevel: 'VIP',
      memberCode: 'M017',
      joinDate: join(2, 0, 1),
    },
  });
  await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      code: 'MEM016',
      name: '謝試用',
      phone: '0910009009',
      memberLevel: 'NORMAL',
      memberCode: 'M018',
      joinDate: new Date(now.getTime() - 1 * 86400000),
    },
  });

  /** 分群（階段 E）：手測 GET /crm/segments/:id/preview 用 */
  const segAll = await prisma.segment.create({
    data: { merchantId: merchant.id, name: '全部 ACTIVE 會員' },
  });
  const segVip = await prisma.segment.create({
    data: {
      merchantId: merchant.id,
      name: 'VIP 會員',
      conditions: { memberLevel: 'VIP' },
    },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: 'GOLD 會員', conditions: { memberLevel: 'GOLD' } },
  });
  /** 分級規則（TierRule） */
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 5000 升 VIP', ruleType: 'SPEND_SUM', threshold: 5000, targetLevel: 'VIP', lookbackDays: 365 },
  });
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 2000 升 GOLD', ruleType: 'SPEND_SUM', threshold: 2000, targetLevel: 'GOLD', lookbackDays: 365 },
  });
  /** 互動紀錄（階段 F）示範一筆 */
  const custForLog = await prisma.customer.findFirst({
    where: { merchantId: merchant.id, code: 'VIP001' },
  });
  if (custForLog) {
    await prisma.customerContactLog.create({
      data: {
        customerId: custForLog.id,
        type: 'CALL',
        note: 'SEED 示範聯絡紀錄',
        createdBy: 'seed',
      },
    });
  }

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
      partyId: `supplier:${supActive1.id}`,
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
  await addBalance(pHay.id, 200, 'SEED-BULK', '初始補貨（含多筆 POS 扣庫）', t0);
  await addBalance(pBowl.id, 200, 'SEED-BULK', '初始補貨（含多筆 POS 扣庫）', t0);
  await addBalance(pLowStock.id, 1, 'SEED-EDGE', '低庫存', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pZeroStock.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  const pSnackForInv = products['DEMO-SNACK-CARROT'];
  const pCageSForInv = products['DEMO-CAGE-S'];
  const pCageLForInv = products['DEMO-CAGE-L'];
  const pToyBallForInv = products['DEMO-TOY-BALL'];
  const pBottleForInv = products['DEMO-BOTTLE-350'];
  await addBalance(pSnackForInv.id, 100, 'SEED-BULK', '零食類初始', t0);
  await addBalance(pCageSForInv.id, 20, 'SEED-BULK', '兔籠初始', t0);
  await addBalance(pCageLForInv.id, 15, 'SEED-BULK', '兔籠初始', t0);
  await addBalance(pToyBallForInv.id, 50, 'SEED-BULK', '玩具初始', t0);
  await addBalance(pBottleForInv.id, 80, 'SEED-BULK', '水壺初始', t0);

  /** POS 訂單 + SALE_OUT（日期分散近 60 天，供報表篩選） */
  const custVip = await prisma.customer.findFirst({
    where: { merchantId: merchant.id, code: 'VIP001' },
  });
  const order1Occurred = daysAgo(30);
  const order1 = await prisma.posOrder.create({
    data: {
      orderNumber: `DEMO-POS-${y}-001`,
      storeId: store.id,
      customerId: custVip!.id,
      subtotalAmount: 300,
      discountAmount: 10,
      totalAmount: 290,
      createdAt: order1Occurred,
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
      occurredAt: order1Occurred,
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
  await prisma.financeEvent.create({
    data: {
      type: 'SALE_RECEIVABLE',
      partyId: `customer:${custVip!.id}`,
      currency: 'TWD',
      amount: 290,
      taxAmount: 0,
      occurredAt: order1Occurred,
      referenceId: order1.id,
      note: `POS ${order1.orderNumber} 應收`,
    },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'SALE_PAYMENT',
      partyId: `customer:${custVip!.id}`,
      currency: 'TWD',
      amount: 290,
      taxAmount: 0,
      occurredAt: order1Occurred,
      referenceId: order1.id,
      note: `POS ${order1.orderNumber} 現金`,
    },
  });
  await prisma.loyaltySettings.create({ data: { merchantId: merchant.id } });
  const coupWelcome = await prisma.loyaltyCoupon.create({
    data: {
      merchantId: merchant.id,
      code: 'WELCOME10',
      name: '新會員折 10 元',
      discountType: 'FIXED',
      value: 10,
      active: true,
    },
  });
  const coup50 = await prisma.loyaltyCoupon.create({
    data: {
      merchantId: merchant.id,
      code: 'VIP50',
      name: 'VIP 滿 500 折 50',
      discountType: 'FIXED',
      value: 50,
      validFrom: new Date(y, 0, 1),
      validTo: new Date(y, 11, 31),
      maxUses: 100,
      active: true,
    },
  });
  /** 發券規則（CrmCouponDispatchRule）— 須在 segment 與 coupon 之後 */
  const segAllCreated = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: '全部 ACTIVE 會員' } });
  const segVipCreated = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: 'VIP 會員' } });
  if (segAllCreated && coupWelcome) {
    await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: merchant.id,
        name: '新會員發歡迎券',
        segmentId: segAllCreated.id,
        couponId: coupWelcome.id,
        enabled: true,
        scheduleType: 'daily',
        nextRunAt: new Date(now.getTime() + 86400000),
      },
    });
  }
  if (segVipCreated && coup50) {
    await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: merchant.id,
        name: 'VIP 發折 50 券',
        segmentId: segVipCreated.id,
        couponId: coup50.id,
        enabled: true,
        scheduleType: 'weekly',
        nextRunAt: new Date(now.getTime() + 7 * 86400000),
      },
    });
  }

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
        createdAt: args.occurredAt,
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
    await prisma.financeEvent.create({
      data: {
        type: 'SALE_RECEIVABLE',
        partyId: `customer:${args.customerId}`,
        currency: 'TWD',
        amount: args.total,
        taxAmount: 0,
        occurredAt: args.occurredAt,
        referenceId: order.id,
        note: `POS ${args.orderNumber} 應收`,
      },
    });
    await prisma.financeEvent.create({
      data: {
        type: 'SALE_PAYMENT',
        partyId: `customer:${args.customerId}`,
        currency: 'TWD',
        amount: args.total,
        taxAmount: 0,
        occurredAt: args.occurredAt,
        referenceId: order.id,
        note: `POS ${args.orderNumber} 實收`,
      },
    });
    return order;
  }
  async function posSaleGuest(args: {
    orderNumber: string;
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
        customerId: null,
        subtotalAmount: args.subtotal,
        discountAmount: args.discount,
        totalAmount: args.total,
        createdAt: args.occurredAt,
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
    const walkinParty = 'STORE:WALKIN';
    await prisma.financeEvent.create({
      data: {
        type: 'SALE_RECEIVABLE',
        partyId: walkinParty,
        currency: 'TWD',
        amount: args.total,
        taxAmount: 0,
        occurredAt: args.occurredAt,
        referenceId: order.id,
        note: `POS ${args.orderNumber} 應收（匿名）`,
      },
    });
    await prisma.financeEvent.create({
      data: {
        type: 'SALE_PAYMENT',
        partyId: walkinParty,
        currency: 'TWD',
        amount: args.total,
        taxAmount: 0,
        occurredAt: args.occurredAt,
        referenceId: order.id,
        note: `POS ${args.orderNumber} 實收（匿名）`,
      },
    });
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
    occurredAt: daysAgo(0),
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
    occurredAt: daysAgo(2),
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
    occurredAt: daysAgo(4),
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
    occurredAt: daysAgo(6),
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
    occurredAt: daysAgo(8),
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
    occurredAt: daysAgo(10),
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
    occurredAt: daysAgo(12),
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
    occurredAt: daysAgo(14),
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
    occurredAt: daysAgo(16),
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
    occurredAt: daysAgo(18),
    lines: [
      { productId: pTee.id, qty: 2, unitPrice: 150 },
      { productId: pBowl.id, qty: 1, unitPrice: 100 },
    ],
    note: 'POS DEMO-POS-012 鄭折抵',
  });
  const order2 = await posSale({
    orderNumber: `DEMO-POS-${y}-002`,
    customerId: custVip!.id,
    subtotal: 280,
    discount: 0,
    total: 280,
    method: 'CREDIT',
    occurredAt: daysAgo(25),
    lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }],
    note: 'POS DEMO-POS-002 賒帳示範',
  });
  /** 更多 POS 訂單：營收趨勢、客單價分布、會員 vs 匿名客 */
  const pSnack = products['DEMO-SNACK-CARROT'];
  const pCageS = products['DEMO-CAGE-S'];
  const pCageL = products['DEMO-CAGE-L'];
  const pToyBall = products['DEMO-TOY-BALL'];
  const pBottle = products['DEMO-BOTTLE-350'];
  const custMem7 = await c('MEM007');
  const custMem8 = await c('MEM008');
  const custMem9 = await c('MEM009');
  const custMem10 = await c('MEM010');
  await posSale({ orderNumber: `DEMO-POS-${y}-013`, customerId: custMem7.id, subtotal: 99, discount: 0, total: 99, method: 'CASH', occurredAt: daysAgo(20), lines: [{ productId: pBowl.id, qty: 1, unitPrice: 99 }], note: '低單' });
  await posSale({ orderNumber: `DEMO-POS-${y}-014`, customerId: custMem8.id, subtotal: 350, discount: 0, total: 350, method: 'CASH', occurredAt: daysAgo(22), lines: [{ productId: pHay.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 25 }], note: '中單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-015`, subtotal: 150, discount: 0, total: 150, method: 'CASH', occurredAt: daysAgo(24), lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }], note: '匿名客' });
  await posSale({ orderNumber: `DEMO-POS-${y}-016`, customerId: custMem9.id, subtotal: 750, discount: 50, total: 700, method: 'CASH', occurredAt: daysAgo(26), lines: [{ productId: pFeed.id, qty: 2, unitPrice: 280 }, { productId: pBowl.id, qty: 2, unitPrice: 95 }], note: '高單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-017`, subtotal: 199, discount: 0, total: 199, method: 'CASH', occurredAt: daysAgo(28), lines: [{ productId: pTeeW.id, qty: 1, unitPrice: 150 }, { productId: pSnack.id, qty: 1, unitPrice: 49 }], note: '匿名' });
  await posSale({ orderNumber: `DEMO-POS-${y}-018`, customerId: custMem10.id, subtotal: 1099, discount: 0, total: 1099, method: 'CASH', occurredAt: daysAgo(30), lines: [{ productId: pCageS.id, qty: 1, unitPrice: 1099 }], note: '高單兔籠' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-019`, subtotal: 1699, discount: 0, total: 1699, method: 'CARD', occurredAt: daysAgo(32), lines: [{ productId: pCageL.id, qty: 1, unitPrice: 1699 }], note: '匿名高單' });
  await posSale({ orderNumber: `DEMO-POS-${y}-020`, customerId: custVip!.id, subtotal: 450, discount: 0, total: 450, method: 'CASH', occurredAt: daysAgo(36), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }, { productId: pHay.id, qty: 1, unitPrice: 150 }, { productId: pToyBall.id, qty: 1, unitPrice: 20 }], note: '上月' });
  await posSale({ orderNumber: `DEMO-POS-${y}-021`, customerId: custGold.id, subtotal: 298, discount: 0, total: 298, method: 'CASH', occurredAt: daysAgo(40), lines: [{ productId: pHay.id, qty: 2, unitPrice: 149 }], note: '上月' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-022`, subtotal: 128, discount: 0, total: 128, method: 'CASH', occurredAt: daysAgo(42), lines: [{ productId: pBottle.id, qty: 1, unitPrice: 129 }], note: '匿名' });
  await posSale({ orderNumber: `DEMO-POS-${y}-023`, customerId: custMem1.id, subtotal: 520, discount: 20, total: 500, method: 'CASH', occurredAt: daysAgo(44), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }, { productId: pHay.id, qty: 1, unitPrice: 150 }, { productId: pBowl.id, qty: 1, unitPrice: 90 }], note: '中高單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-024`, subtotal: 85, discount: 0, total: 85, method: 'CASH', occurredAt: daysAgo(46), lines: [{ productId: pSnack.id, qty: 1, unitPrice: 65 }, { productId: pToyBall.id, qty: 1, unitPrice: 20 }], note: '低單匿名' });
  await posSale({ orderNumber: `DEMO-POS-${y}-025`, customerId: custMem5.id, subtotal: 2200, discount: 200, total: 2000, method: 'CARD', occurredAt: daysAgo(48), lines: [{ productId: pCageL.id, qty: 1, unitPrice: 1699 }, { productId: pBottle.id, qty: 2, unitPrice: 129 }], note: '超高單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-026`, subtotal: 399, discount: 0, total: 399, method: 'CASH', occurredAt: daysAgo(50), lines: [{ productId: pTee.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 49 }], note: '匿名' });
  await posSale({ orderNumber: `DEMO-POS-${y}-027`, customerId: custMem3.id, subtotal: 180, discount: 0, total: 180, method: 'CASH', occurredAt: daysAgo(52), lines: [{ productId: pHay.id, qty: 1, unitPrice: 150 }, { productId: pToyBall.id, qty: 1, unitPrice: 30 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-028`, customerId: custMem2.id, subtotal: 650, discount: 0, total: 650, method: 'CASH', occurredAt: daysAgo(54), lines: [{ productId: pFeed.id, qty: 2, unitPrice: 280 }, { productId: pBowl.id, qty: 1, unitPrice: 90 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-029`, subtotal: 278, discount: 0, total: 278, method: 'CASH', occurredAt: daysAgo(56), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 278 }], note: '匿名' });
  await posSale({ orderNumber: `DEMO-POS-${y}-030`, customerId: custMem6.id, subtotal: 115, discount: 0, total: 115, method: 'CASH', occurredAt: daysAgo(58), lines: [{ productId: pBowl.id, qty: 1, unitPrice: 99 }, { productId: pSnack.id, qty: 1, unitPrice: 16 }], note: '' });
  const ts = (d: number, offsetMin = 1) => new Date(daysAgo(d).getTime() + offsetMin * 60000);
  const ledgerRows: {
    customerId: string;
    type: 'EARNED' | 'BURNED' | 'EXPIRED';
    amount: number;
    balanceAfter: number;
    referenceId: string | null;
    note: string;
    createdAt: Date;
  }[] = [
    { customerId: custVip!.id, type: 'EARNED', amount: 2, balanceAfter: 2, referenceId: order1.id, note: `贈點 ${order1.orderNumber}`, createdAt: ts(30) },
    { customerId: custVip!.id, type: 'EARNED', amount: 2, balanceAfter: 4, referenceId: order2.id, note: `贈點 ${order2.orderNumber}`, createdAt: ts(25) },
    { customerId: custVip!.id, type: 'EARNED', amount: 4, balanceAfter: 8, referenceId: order1b.id, note: `贈點 ${order1b.orderNumber}`, createdAt: ts(0) },
    { customerId: custGold.id, type: 'EARNED', amount: 3, balanceAfter: 3, referenceId: orderGold.id, note: `贈點 ${orderGold.orderNumber}`, createdAt: ts(2) },
    { customerId: custGold.id, type: 'BURNED', amount: 2, balanceAfter: 1, referenceId: null, note: '結帳折抵 2 點（seed）', createdAt: ts(4, 0) },
    { customerId: custMem1.id, type: 'EARNED', amount: 1, balanceAfter: 1, referenceId: orderMem1a.id, note: `贈點 ${orderMem1a.orderNumber}`, createdAt: ts(4) },
    { customerId: custMem1.id, type: 'EARNED', amount: 1, balanceAfter: 2, referenceId: orderMem1b.id, note: `贈點 ${orderMem1b.orderNumber}`, createdAt: ts(6) },
    { customerId: custMem2.id, type: 'EARNED', amount: 3, balanceAfter: 3, referenceId: orderMem2.id, note: `贈點 ${orderMem2.orderNumber}`, createdAt: ts(8) },
    { customerId: custMem3.id, type: 'EARNED', amount: 2, balanceAfter: 2, referenceId: orderMem3.id, note: `贈點 ${orderMem3.orderNumber}`, createdAt: ts(10) },
    { customerId: custMem5.id, type: 'EARNED', amount: 1, balanceAfter: 1, referenceId: orderMem5a.id, note: `贈點 ${orderMem5a.orderNumber}`, createdAt: ts(12) },
    { customerId: custMem5.id, type: 'EARNED', amount: 1, balanceAfter: 2, referenceId: orderMem5b.id, note: `贈點 ${orderMem5b.orderNumber}`, createdAt: ts(14) },
    { customerId: custMem5.id, type: 'EARNED', amount: 3, balanceAfter: 5, referenceId: orderMem5c.id, note: `贈點 ${orderMem5c.orderNumber}`, createdAt: ts(16) },
    { customerId: custMem5.id, type: 'EXPIRED', amount: 1, balanceAfter: 4, referenceId: null, note: '效期到期沖銷 1 點（seed 示範）', createdAt: ts(18, 0) },
    { customerId: custMem6.id, type: 'EARNED', amount: 4, balanceAfter: 4, referenceId: orderMem6.id, note: `贈點 ${orderMem6.orderNumber}`, createdAt: ts(18) },
    { customerId: custMem6.id, type: 'BURNED', amount: 3, balanceAfter: 1, referenceId: null, note: '兌換折 3 點（seed）', createdAt: ts(18, 60) },
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
      name: '滿百折十（小計100→折10）',
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
