/**
 * 完整 DEMO SEED：每次執行先清空業務表再重建，單一可重現劇本。
 * 含：商品（含重量／規格／款式／效期）、會員／供應商／採購／驗收／庫存／POS／促銷／分群／發券。
 * 數據量較大，符合商品、會員、促銷、銷售、報表各層級測試需求。
 *
 * 警告：會刪除資料庫內既有業務資料（含 E2E／測試用）。
 * 推薦完整清除：pnpm db:reset（migrate reset 後自動跑本 seed）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 產生台灣格式 EAN-13 條碼（前綴 471）。base 為 9 位數字字串，會自動計算校驗碼 */
function ean13Taiwan(base: string): string {
  const digits = ('471' + base.padStart(9, '0').slice(-9)).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i]! * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return digits.join('') + check;
}

/**
 * 清除所有業務表（含 E2E 測試資料），依 FK 從子表到父表順序。
 * 關鍵依賴：`PosReturn.orderId` → `PosOrder`（須先刪 `posReturn`）；
 * `PosOrderItem`／`PosOrderPayment` → `PosOrder`；`InventoryEvent`／`InventoryBalance` 在訂單之後；
 * `FinanceEvent` 可早於或晚於訂單（無 FK 至 PosOrder id 時）；`Customer` 前須清 `pointLedger` 等。
 */
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
  await prisma.posReturn.deleteMany();
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
  await prisma.cashRegisterSession.deleteMany();
  await prisma.posHeldCart.deleteMany();
  await prisma.store.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  console.log('wipeAll: 已清除所有業務表（含測試資料）');
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
  const storeSessions = await prisma.store.create({
    data: { code: 'S002', name: 'Demo 門市二（關帳示範）', merchantId: merchant.id },
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

  /** 效期模式：productionDate+shelfLifeMonths（推算）或 expiryDate（直接） */
  const prodDate = (monthsAgo: number) => { const d = new Date(now); d.setMonth(d.getMonth() - monthsAgo); return d; };
  const expDate = (monthsAhead: number) => { const d = new Date(now); d.setMonth(d.getMonth() + monthsAhead); return d; };
  const productData = [
    { sku: 'DEMO-TEE-BLK-M', barcode: ean13Taiwan('100000001'), name: '經典黑 T M', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'M', specStyle: '圓領', specWeight: '180g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-BLK-L', barcode: ean13Taiwan('100000002'), name: '經典黑 T L', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'L', specStyle: '圓領', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-WHT-M', barcode: ean13Taiwan('100000003'), name: '經典白 T M', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['熱銷'], specSize: 'M', specStyle: '圓領', specWeight: '175g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-WHT-L', barcode: ean13Taiwan('100000004'), name: '經典白 T L', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: [], specSize: 'L', specStyle: '圓領', specWeight: '195g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TEE-GRY-S', barcode: ean13Taiwan('100000005'), name: '經典灰 T S', cat: catClothes, brand: brandHouse, list: 199, sale: 150, cost: 80, tags: ['新品'], specSize: 'S', specStyle: '圓領', specWeight: '160g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-FEED-ADULT', barcode: ean13Taiwan('200000001'), name: '成兔飼料 2kg', cat: catFeed, brand: brandFeed, list: 320, sale: 280, cost: 180, tags: ['熱銷'], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '常溫 12 個月', productionDate: prodDate(3), shelfLifeMonths: 12 },
    { sku: 'DEMO-FEED-JR', barcode: ean13Taiwan('200000002'), name: '幼兔飼料 1kg', cat: catFeed, brand: brandFeed, list: 200, sale: 179, cost: 100, tags: [], specSize: null, specStyle: null, specWeight: '1kg', specCapacity: null, expiryDescription: '常溫 12 個月', expiryDate: expDate(6) },
    { sku: 'DEMO-FEED-SENIOR', barcode: ean13Taiwan('200000003'), name: '高齡兔飼料 2kg', cat: catFeed, brand: brandFeed, list: 380, sale: 340, cost: 200, tags: [], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '常溫 10 個月', productionDate: prodDate(2), shelfLifeMonths: 10 },
    { sku: 'DEMO-HAY-TIMOTHY', barcode: ean13Taiwan('300000001'), name: '提摩西牧草 1kg', cat: catHay, brand: brandHouse, list: 180, sale: 150, cost: 90, tags: ['熱銷'], specSize: null, specStyle: null, specWeight: '1kg', specCapacity: null, expiryDescription: '乾燥保存 6 個月', productionDate: prodDate(2), shelfLifeMonths: 6 },
    { sku: 'DEMO-HAY-ALFALFA', barcode: ean13Taiwan('300000002'), name: '苜蓿牧草 500g', cat: catHay, brand: brandHouse, list: 120, sale: 99, cost: 50, tags: [], specSize: null, specStyle: null, specWeight: '500g', specCapacity: null, expiryDescription: '乾燥保存 6 個月', productionDate: prodDate(1), shelfLifeMonths: 6 },
    { sku: 'DEMO-HAY-MIX', barcode: ean13Taiwan('300000003'), name: '綜合牧草 2kg', cat: catHay, brand: brandPremium, list: 350, sale: 299, cost: 160, tags: [], specSize: null, specStyle: null, specWeight: '2kg', specCapacity: null, expiryDescription: '乾燥保存 6 個月', productionDate: prodDate(3), shelfLifeMonths: 6 },
    { sku: 'DEMO-BOWL-S', barcode: ean13Taiwan('400000001'), name: '食盆 小', cat: catSupplies, brand: brandHouse, list: 120, sale: 99, cost: 45, tags: [], specSize: 'S', specStyle: '圓形', specWeight: '80g', specCapacity: '200ml', expiryDescription: null },
    { sku: 'DEMO-BOWL-M', barcode: ean13Taiwan('400000002'), name: '食盆 中', cat: catSupplies, brand: brandHouse, list: 180, sale: 149, cost: 65, tags: [], specSize: 'M', specStyle: '圓形', specWeight: '150g', specCapacity: '400ml', expiryDescription: null },
    { sku: 'DEMO-BOWL-L', barcode: ean13Taiwan('400000003'), name: '食盆 大', cat: catSupplies, brand: brandHouse, list: 250, sale: 199, cost: 90, tags: [], specSize: 'L', specStyle: '圓形', specWeight: '280g', specCapacity: '800ml', expiryDescription: null },
    { sku: 'DEMO-BOTTLE-350', barcode: ean13Taiwan('400000004'), name: '滾珠水壺 350ml', cat: catSupplies, brand: brandHouse, list: 150, sale: 129, cost: 55, tags: [], specSize: null, specStyle: '滾珠', specWeight: '120g', specCapacity: '350ml', expiryDescription: null },
    { sku: 'DEMO-BOTTLE-600', barcode: ean13Taiwan('400000005'), name: '滾珠水壺 600ml', cat: catSupplies, brand: brandPremium, list: 220, sale: 189, cost: 85, tags: [], specSize: null, specStyle: '滾珠', specWeight: '180g', specCapacity: '600ml', expiryDescription: null },
    { sku: 'DEMO-LOW-STOCK', barcode: ean13Taiwan('400000006'), name: '低庫存測試品', cat: catSupplies, brand: brandHouse, list: 50, sale: 50, cost: 20, tags: ['清倉'], specSize: 'S', specStyle: '標準', specWeight: '50g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-SUPPLIES-ZERO', barcode: ean13Taiwan('400000007'), name: '用品零庫存測試', cat: catSupplies, brand: brandHouse, list: 80, sale: 80, cost: 35, tags: ['清倉'], specSize: 'S', specStyle: '標準', specWeight: '60g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-ZERO-STOCK', barcode: ean13Taiwan('100000006'), name: '零庫存測試品', cat: catClothes, brand: brandPremium, list: 399, sale: 399, cost: 150, tags: ['清倉'], specSize: 'M', specStyle: '限量款', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-SNACK-CARROT', barcode: ean13Taiwan('500000001'), name: '胡蘿蔔乾 50g', cat: catSnacks, brand: brandHouse, list: 80, sale: 65, cost: 25, tags: [], specSize: null, specStyle: null, specWeight: '50g', specCapacity: null, expiryDescription: '常溫 3 個月', productionDate: prodDate(1), shelfLifeMonths: 3 },
    { sku: 'DEMO-SNACK-APPLE', barcode: ean13Taiwan('500000002'), name: '蘋果片 30g', cat: catSnacks, brand: brandPremium, list: 60, sale: 49, cost: 18, tags: ['新品'], specSize: null, specStyle: null, specWeight: '30g', specCapacity: null, expiryDescription: '常溫 2 個月', expiryDate: expDate(2) },
    { sku: 'DEMO-SNACK-ZERO', barcode: ean13Taiwan('500000003'), name: '零食零庫存測試', cat: catSnacks, brand: brandHouse, list: 45, sale: 45, cost: 15, tags: [], specSize: null, specStyle: null, specWeight: '25g', specCapacity: null, expiryDescription: '常溫 2 個月', expiryDate: expDate(1) },
    { sku: 'DEMO-TOY-BALL', barcode: ean13Taiwan('600000001'), name: '草球玩具', cat: catToys, brand: brandHouse, list: 89, sale: 75, cost: 30, tags: [], specSize: '直徑 8cm', specStyle: '圓球', specWeight: '40g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TOY-TUNNEL', barcode: ean13Taiwan('600000002'), name: '隧道玩具', cat: catToys, brand: brandPremium, list: 299, sale: 249, cost: 100, tags: [], specSize: '長 60cm', specStyle: '可折疊', specWeight: '200g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-TOY-ZERO', barcode: ean13Taiwan('600000003'), name: '玩具零庫存測試', cat: catToys, brand: brandHouse, list: 59, sale: 59, cost: 25, tags: [], specSize: '小', specStyle: '標準', specWeight: '30g', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-CAGE-S', barcode: ean13Taiwan('400000008'), name: '兔籠 S 號', cat: catSupplies, brand: brandImport, list: 1299, sale: 1099, cost: 500, tags: [], specSize: 'S', specStyle: '單層', specWeight: '3kg', specCapacity: null, expiryDescription: null },
    { sku: 'DEMO-CAGE-L', barcode: ean13Taiwan('400000009'), name: '兔籠 L 號', cat: catSupplies, brand: brandImport, list: 1999, sale: 1699, cost: 750, tags: ['熱銷'], specSize: 'L', specStyle: '雙層', specWeight: '5kg', specCapacity: null, expiryDescription: null },
  ];
  const products: Record<string, Awaited<ReturnType<typeof prisma.product.create>>> = {} as any;
  for (const p of productData) {
    const created = await prisma.product.create({
      data: {
        sku: p.sku,
        barcode: p.barcode,
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
        productionDate: 'productionDate' in p ? p.productionDate : undefined,
        shelfLifeMonths: 'shelfLifeMonths' in p ? p.shelfLifeMonths : undefined,
        expiryDate: 'expiryDate' in p ? p.expiryDate : undefined,
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

  /** ProductTag：商品標籤示範，供前端類別管理／商品頁選用；含 POS 折扣自動條件示範 */
  await prisma.productTag.create({
    data: {
      merchantId: merchant.id,
      code: 'SEED-TAG-HOT',
      name: '熱銷',
      sortOrder: 0,
      showInPosDiscount: true,
      autoCondition: { type: 'SALES_QTY', lookbackDays: 30, minQty: 5 },
    },
  });
  await prisma.productTag.create({
    data: {
      merchantId: merchant.id,
      code: 'SEED-TAG-NEW',
      name: '新品',
      sortOrder: 1,
      showInPosDiscount: true,
      autoCondition: { type: 'NEW_ARRIVAL', withinDays: 30 },
    },
  });
  await prisma.productTag.create({
    data: {
      merchantId: merchant.id,
      code: 'SEED-TAG-CLEARANCE',
      name: '清倉',
      sortOrder: 2,
      showInPosDiscount: true,
      autoCondition: { type: 'LOW_STOCK', maxQty: 3 },
    },
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
  /** 加倍：更多會員 dummy（MEM017～MEM034） */
  const moreCustData = [
    { code: 'MEM017', name: '錢常買', phone: '0910010001', level: 'VIP' as const, memberCode: 'M019', daysAgo: 3 },
    { code: 'MEM018', name: '孫試吃', phone: '0910011002', level: 'NORMAL' as const, memberCode: 'M020', daysAgo: 7 },
    { code: 'MEM019', name: '李回頭', phone: '0910012003', level: 'GOLD' as const, memberCode: 'M021', daysAgo: 14 },
    { code: 'MEM020', name: '周小慧', phone: '0910013004', level: 'NORMAL' as const, memberCode: 'M022', daysAgo: 21 },
    { code: 'MEM021', name: '吳大志', phone: '0910014005', level: 'VIP' as const, memberCode: 'M023', daysAgo: 28 },
    { code: 'MEM022', name: '鄭美玲', phone: '0910015006', level: 'NORMAL' as const, memberCode: 'M024', daysAgo: 35 },
    { code: 'MEM023', name: '王建明', phone: '0910016007', level: 'GOLD' as const, memberCode: 'M025', daysAgo: 42 },
    { code: 'MEM024', name: '陳雅婷', phone: '0910017008', level: 'NORMAL' as const, memberCode: 'M026', daysAgo: 49 },
    { code: 'MEM025', name: '林志豪', phone: '0910018009', level: 'VIP' as const, memberCode: 'M027', daysAgo: 56 },
    { code: 'MEM026', name: '黃淑芬', phone: '0910019010', level: 'NORMAL' as const, memberCode: 'M028', daysAgo: 5 },
    { code: 'MEM027', name: '劉俊傑', phone: '0910020011', level: 'GOLD' as const, memberCode: 'M029', daysAgo: 12 },
    { code: 'MEM028', name: '楊雅筑', phone: '0910021012', level: 'NORMAL' as const, memberCode: 'M030', daysAgo: 19 },
    { code: 'MEM029', name: '張志偉', phone: '0910022013', level: 'VIP' as const, memberCode: 'M031', daysAgo: 26 },
    { code: 'MEM030', name: '何美惠', phone: '0910023014', level: 'NORMAL' as const, memberCode: 'M032', daysAgo: 33 },
    { code: 'MEM031', name: '許明達', phone: '0910024015', level: 'GOLD' as const, memberCode: 'M033', daysAgo: 40 },
    { code: 'MEM032', name: '羅雅如', phone: '0910025016', level: 'NORMAL' as const, memberCode: 'M034', daysAgo: 47 },
    { code: 'MEM033', name: '謝俊賢', phone: '0910026017', level: 'VIP' as const, memberCode: 'M035', daysAgo: 54 },
    { code: 'MEM034', name: '唐怡君', phone: '0910027018', level: 'NORMAL' as const, memberCode: 'M036', daysAgo: 2 },
  ];
  for (const c of moreCustData) {
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        memberLevel: c.level,
        memberCode: c.memberCode,
        joinDate: new Date(now.getTime() - c.daysAgo * 86400000),
      },
    });
  }

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
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: 'NORMAL 會員', conditions: { memberLevel: 'NORMAL' } },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: '多筆消費會員', conditions: { minOrderCount: 2 } },
  });
  /** 加倍：更多分群（使用 memberLevel／tag 等既有條件） */
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: 'VIP 常客', conditions: { memberLevel: 'VIP' } },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: 'GOLD 常客', conditions: { memberLevel: 'GOLD' } },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: 'NORMAL 新客', conditions: { memberLevel: 'NORMAL' } },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: '潛力會員', conditions: { memberLevel: 'NORMAL' } },
  });
  await prisma.segment.create({
    data: { merchantId: merchant.id, name: '銀卡以上', conditions: { memberLevel: 'GOLD' } },
  });
  /** 分級規則（TierRule）：4 筆（加倍） */
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 5000 升 VIP', ruleType: 'SPEND_SUM', threshold: 5000, targetLevel: 'VIP', lookbackDays: 365 },
  });
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 2000 升 GOLD', ruleType: 'SPEND_SUM', threshold: 2000, targetLevel: 'GOLD', lookbackDays: 365 },
  });
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 10000 升 VIP', ruleType: 'SPEND_SUM', threshold: 10000, targetLevel: 'VIP', lookbackDays: 365 },
  });
  await prisma.tierRule.create({
    data: { merchantId: merchant.id, name: '消費滿 3000 升 GOLD', ruleType: 'SPEND_SUM', threshold: 3000, targetLevel: 'GOLD', lookbackDays: 180 },
  });
  /** 互動紀錄（階段 F）：10 筆（加倍），不同客戶與類型 */
  const custsForLog = await prisma.customer.findMany({
    where: { merchantId: merchant.id, code: { in: ['VIP001', 'VIP002', 'MEM001', 'MEM005', 'MEM010', 'MEM007', 'MEM015', 'MEM020', 'MEM025', 'MEM030'] } },
  });
  const logTypes = ['CALL', 'VISIT', 'NOTE', 'CALL', 'VISIT', 'CALL', 'NOTE', 'VISIT', 'CALL', 'NOTE'] as const;
  for (let i = 0; i < Math.min(10, custsForLog.length, logTypes.length); i++) {
    await prisma.customerContactLog.create({
      data: {
        customerId: custsForLog[i].id,
        type: logTypes[i],
        note: `SEED 示範聯絡紀錄 ${i + 1}`,
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
  /** 加倍：額外供應商 */
  const supActive4 = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-東昇食品',
      name: '東昇食品原料行',
      contactPerson: '李東昇',
      phone: '05-5566-7788',
      paymentTerms: '月結60天',
      status: 'ACTIVE',
      email: 'lee@tungsheng-food.com',
    },
  });
  const supActive5 = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      code: 'SUP-瑞豐包裝',
      name: '瑞豐包裝材料',
      contactPerson: '張瑞豐',
      phone: '06-6677-8899',
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
  async function addBalanceIncrement(productId: string, qty: number, ref: string, note: string, at: Date) {
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
    await prisma.inventoryBalance.update({
      where: { productId_warehouseId: { productId, warehouseId: warehouse.id } },
      data: { onHandQty: { increment: qty } },
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

  /** 2) PO CANCELLED（供應商不足／取消）：10 筆（加倍） */
  const poProducts = [pBowl, pHay, pFeed, pTee, pTeeW];
  for (let i = 0; i < 10; i++) {
    const pid = poProducts[i % poProducts.length]!.id;
    await prisma.purchaseOrder.create({
      data: {
        merchantId: merchant.id,
        supplierId: i === 0 ? supInactive.id : supActive1.id,
        warehouseId: warehouse.id,
        orderNumber: `DEMO-PO-${y}-CANCEL${i + 1}`,
        status: 'CANCELLED',
        orderDate: new Date(now.getTime() - (45 + i * 3) * 86400000),
        lines: { create: [{ productId: pid, qtyOrdered: 10 + i * 5, unitCost: 50 }] },
      },
    });
  }

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
      createdAt: daysAgo(5),
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
      createdAt: daysAgo(5),
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

  /** 8a) 部分退貨給供應商：5 筆 RETURN_TO_SUPPLIER + PURCHASE_RETURN，分散時間供報表篩選 */
  const returnToSupItems: { lineId: string; productId: string; qty: number; cost: number; rnId: string; rnReceipt: string; at: Date; supId: string }[] = [
    { lineId: rnPartial.lines[0].id, productId: pFeed.id, qty: 5, cost: 180, rnId: rnPartial.id, rnReceipt: rnPartial.receiptNumber, at: new Date(y, 2, 20, 14, 0), supId: supActive2.id },
    { lineId: rnPartial.lines[0].id, productId: pFeed.id, qty: 1, cost: 180, rnId: rnPartial.id, rnReceipt: rnPartial.receiptNumber, at: new Date(y, 2, 21, 10, 0), supId: supActive2.id },
    { lineId: rnFull.lines[0].id, productId: pTee.id, qty: 2, cost: 80, rnId: rnFull.id, rnReceipt: rnFull.receiptNumber, at: new Date(y, 2, 22, 11, 0), supId: supActive1.id },
    { lineId: rnFull.lines[1].id, productId: pTeeW.id, qty: 2, cost: 80, rnId: rnFull.id, rnReceipt: rnFull.receiptNumber, at: new Date(y, 2, 23, 9, 0), supId: supActive1.id },
  ];
  for (const r of returnToSupItems) {
    await prisma.inventoryEvent.create({
      data: {
        productId: r.productId,
        warehouseId: warehouse.id,
        type: 'RETURN_TO_SUPPLIER',
        quantity: -r.qty,
        occurredAt: r.at,
        referenceId: r.lineId,
        note: `部分退貨給供應商 RN ${r.rnReceipt}`,
      },
    });
    await prisma.inventoryBalance.update({
      where: { productId_warehouseId: { productId: r.productId, warehouseId: warehouse.id } },
      data: { onHandQty: { decrement: r.qty } },
    });
    await prisma.financeEvent.create({
      data: {
        type: 'PURCHASE_RETURN',
        partyId: `supplier:${r.supId}`,
        currency: 'TWD',
        amount: r.qty * r.cost,
        taxAmount: 0,
        occurredAt: r.at,
        referenceId: r.rnId,
        note: `PURCHASE_RETURN RN ${r.rnReceipt} 部分退貨`,
      },
    });
  }

  /** 8b) RN RETURNED（整單退回，不入庫）：10 筆供報表篩選（加倍） */
  for (let i = 0; i < 10; i++) {
    const poR = await prisma.purchaseOrder.create({
      data: {
        merchantId: merchant.id,
        supplierId: i === 0 ? supInactive.id : supActive3.id,
        warehouseId: warehouse.id,
        orderNumber: `DEMO-PO-${y}-RET${i + 1}`,
        status: 'ORDERED',
        orderDate: new Date(now.getTime() - (30 + i * 5) * 86400000),
        lines: { create: [{ productId: [pZeroStock, pLowStock, pHay, pBowl, products['DEMO-SNACK-CARROT']][i % 5].id, qtyOrdered: 5 + i, unitCost: 50 }] },
      },
      include: { lines: true },
    });
    await prisma.receivingNote.create({
      data: {
        merchantId: merchant.id,
        receiptNumber: `DEMO-RN-${y}-RET${i + 1}`,
        purchaseOrderId: poR.id,
        inspectorName: '倉管-王大明',
        status: 'RETURNED',
        remark: '整批退貨',
        inspectionDate: new Date(now.getTime() - (28 + i * 5) * 86400000),
        lines: {
          create: [{ purchaseOrderLineId: poR.lines[0].id, orderedQty: 5 + i, receivedQty: 0, qualifiedQty: 0, returnedQty: 0 }],
        },
      },
    });
  }

  /** 其餘商品初始庫存。每分類：多庫存、少庫存、0庫存各至少一商品 */
  const t0 = new Date(y, 0, 1);
  const pTeeGry = products['DEMO-TEE-GRY-S'];
  const pHayAlfalfa = products['DEMO-HAY-ALFALFA'];
  const pHayMix = products['DEMO-HAY-MIX'];
  const pFeedJr = products['DEMO-FEED-JR'];
  const pFeedSenior = products['DEMO-FEED-SENIOR'];
  const pSnackApple = products['DEMO-SNACK-APPLE'];
  const pSnackZero = products['DEMO-SNACK-ZERO'];
  const pSuppliesZero = products['DEMO-SUPPLIES-ZERO'];
  const pToyTunnel = products['DEMO-TOY-TUNNEL'];
  const pToyZero = products['DEMO-TOY-ZERO'];
  await addBalance(pTeeGry.id, 2, 'SEED-EDGE', '衣服少庫存', t0);
  await addBalance(pHay.id, 200, 'SEED-BULK', '牧草多庫存（提摩西）', t0);
  await addBalance(pHayAlfalfa.id, 3, 'SEED-EDGE', '牧草少庫存（苜蓿）', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pHayMix.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  await addBalanceIncrement(pFeed.id, 41, 'SEED-BULK', '飼料補足至多庫存（成兔 50）', t0);
  await addBalance(pFeedJr.id, 2, 'SEED-EDGE', '飼料少庫存（幼兔）', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pFeedSenior.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  await addBalance(pBowl.id, 200, 'SEED-BULK', '用品多庫存', t0);
  await addBalance(pLowStock.id, 1, 'SEED-EDGE', '用品少庫存', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pSuppliesZero.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  await prisma.inventoryBalance.create({
    data: { productId: pZeroStock.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  const pSnackForInv = products['DEMO-SNACK-CARROT'];
  const pCageSForInv = products['DEMO-CAGE-S'];
  const pCageLForInv = products['DEMO-CAGE-L'];
  const pToyBallForInv = products['DEMO-TOY-BALL'];
  const pBottleForInv = products['DEMO-BOTTLE-350'];
  await addBalance(pSnackForInv.id, 100, 'SEED-BULK', '零食多庫存', t0);
  await addBalance(pSnackApple.id, 2, 'SEED-EDGE', '零食少庫存', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pSnackZero.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  await addBalance(pToyBallForInv.id, 50, 'SEED-BULK', '玩具多庫存', t0);
  await addBalance(pToyTunnel.id, 2, 'SEED-EDGE', '玩具少庫存', t0);
  await prisma.inventoryBalance.create({
    data: { productId: pToyZero.id, warehouseId: warehouse.id, onHandQty: 0 },
  });
  /** 即期批次：採購→驗收→入庫鏈，與 PO/RN/InventoryEvent 一致 */
  const expiringDate = new Date(now);
  expiringDate.setDate(expiringDate.getDate() + 14);
  expiringDate.setHours(12, 0, 0, 0);
  const poExpiring = await prisma.purchaseOrder.create({
    data: {
      merchantId: merchant.id,
      supplierId: supActive1.id,
      warehouseId: warehouse.id,
      orderNumber: `DEMO-PO-${y}-EXPIRING`,
      status: 'ORDERED',
      orderDate: daysAgo(2),
      expectedDate: daysAgo(1),
      lines: { create: [{ productId: pSnackForInv.id, qtyOrdered: 5, qtyReceived: 5, unitCost: 25 }] },
    },
    include: { lines: true },
  });
  const rnExpiring = await prisma.receivingNote.create({
    data: {
      merchantId: merchant.id,
      receiptNumber: `DEMO-RN-${y}-EXPIRING`,
      purchaseOrderId: poExpiring.id,
      inspectorName: '倉管-李小華',
      status: 'COMPLETED',
      inspectionDate: daysAgo(1),
      remark: '即期批次示範',
      createdAt: daysAgo(5),
      lines: {
        create: [
          {
            purchaseOrderLineId: poExpiring.lines[0].id,
            orderedQty: 5,
            receivedQty: 5,
            qualifiedQty: 5,
            returnedQty: 0,
            batchCode: 'SEED-EXP-001',
            expiryDate: expiringDate,
          },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.purchaseOrder.update({
    where: { id: poExpiring.id },
    data: { status: 'RECEIVED' },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'PURCHASE_PAYABLE',
      partyId: `supplier:${supActive1.id}`,
      currency: 'TWD',
      amount: 125,
      taxAmount: 0,
      occurredAt: daysAgo(1),
      referenceId: rnExpiring.id,
      note: `PURCHASE_PAYABLE RN ${rnExpiring.receiptNumber} (即期批次)`,
    },
  });
  await prisma.inventoryEvent.create({
    data: {
      productId: pSnackForInv.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 5,
      batchCode: 'SEED-EXP-001',
      expiryDate: expiringDate,
      occurredAt: daysAgo(1),
      referenceId: rnExpiring.lines[0].id,
      note: '驗收 DEMO-RN-EXPIRING 合格入庫（即期批次）',
    },
  });
  await prisma.inventoryBalance.update({
    where: {
      productId_warehouseId: { productId: pSnackForInv.id, warehouseId: warehouse.id },
    },
    data: { onHandQty: { increment: 5 } },
  });
  /** 8a 第5筆：即期批次部分退供應商 */
  await prisma.inventoryEvent.create({
    data: {
      productId: pSnackForInv.id,
      warehouseId: warehouse.id,
      type: 'RETURN_TO_SUPPLIER',
      quantity: -1,
      occurredAt: daysAgo(3),
      referenceId: rnExpiring.lines[0].id,
      note: `部分退貨給供應商 RN ${rnExpiring.receiptNumber}`,
    },
  });
  await prisma.inventoryBalance.update({
    where: { productId_warehouseId: { productId: pSnackForInv.id, warehouseId: warehouse.id } },
    data: { onHandQty: { decrement: 1 } },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'PURCHASE_RETURN',
      partyId: `supplier:${supActive1.id}`,
      currency: 'TWD',
      amount: 25,
      taxAmount: 0,
      occurredAt: daysAgo(3),
      referenceId: rnExpiring.id,
      note: `PURCHASE_RETURN RN ${rnExpiring.receiptNumber} 部分退貨`,
    },
  });
  await addBalance(pCageSForInv.id, 20, 'SEED-BULK', '兔籠初始', t0);
  await addBalance(pCageLForInv.id, 15, 'SEED-BULK', '兔籠初始', t0);
  await addBalance(pBottleForInv.id, 80, 'SEED-BULK', '水壺初始', t0);

  /** CashRegisterSession 示範：2 OPEN、4 CLOSED（加倍），openedAt 分散過去 7 天，供 AdminPosSessionsPage 列表（使用 S002 避免與 pos-sessions 整合測試衝突） */
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 5000,
      openedAt: daysAgo(1),
      openedBy: '李小華',
      status: 'OPEN',
    },
  });
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 4500,
      openedAt: daysAgo(0),
      openedBy: '王大明',
      status: 'OPEN',
    },
  });
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 3000,
      openedAt: daysAgo(3),
      closedAt: daysAgo(3),
      openedBy: '王大明',
      closedBy: '王大明',
      status: 'CLOSED',
      expectedCashAmount: 3200,
      actualCashAmount: 3180,
      differenceAmount: -20,
    },
  });
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 4000,
      openedAt: daysAgo(6),
      closedAt: daysAgo(6),
      openedBy: '陳小美',
      closedBy: '陳小美',
      status: 'CLOSED',
      expectedCashAmount: 4500,
      actualCashAmount: 4500,
      differenceAmount: 0,
    },
  });
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 3500,
      openedAt: daysAgo(4),
      closedAt: daysAgo(4),
      openedBy: '李小華',
      closedBy: '李小華',
      status: 'CLOSED',
      expectedCashAmount: 3800,
      actualCashAmount: 3820,
      differenceAmount: 20,
    },
  });
  await prisma.cashRegisterSession.create({
    data: {
      storeId: storeSessions.id,
      merchantId: merchant.id,
      openingCashAmount: 4200,
      openedAt: daysAgo(5),
      closedAt: daysAgo(5),
      openedBy: '陳小美',
      closedBy: '陳小美',
      status: 'CLOSED',
      expectedCashAmount: 4600,
      actualCashAmount: 4580,
      differenceAmount: -20,
    },
  });

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
  const coup20 = await prisma.loyaltyCoupon.create({
    data: {
      merchantId: merchant.id,
      code: 'GOLD20',
      name: 'GOLD 滿 300 折 20',
      discountType: 'FIXED',
      value: 20,
      validFrom: new Date(y, 0, 1),
      validTo: new Date(y, 11, 31),
      maxUses: 200,
      active: true,
    },
  });
  const coup30 = await prisma.loyaltyCoupon.create({
    data: {
      merchantId: merchant.id,
      code: 'FEST30',
      name: '節慶折 30',
      discountType: 'FIXED',
      value: 30,
      validFrom: new Date(y, 0, 1),
      validTo: new Date(y, 11, 31),
      maxUses: 50,
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
  const segGold = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: 'GOLD 會員' } });
  const segNormal = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: 'NORMAL 會員' } });
  const segMulti = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: '多筆消費會員' } });
  if (segGold && coupWelcome) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: 'GOLD 會員發歡迎券', segmentId: segGold.id, couponId: coupWelcome.id, enabled: true, scheduleType: 'weekly', nextRunAt: new Date(now.getTime() + 7 * 86400000) },
    });
  }
  if (segNormal && coupWelcome) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: 'NORMAL 會員發歡迎券', segmentId: segNormal.id, couponId: coupWelcome.id, enabled: true, scheduleType: 'daily', nextRunAt: new Date(now.getTime() + 86400000) },
    });
  }
  if (segMulti && coup50) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: '多筆消費發折 50 券', segmentId: segMulti.id, couponId: coup50.id, enabled: true, scheduleType: 'weekly', nextRunAt: new Date(now.getTime() + 14 * 86400000) },
    });
  }
  const segVipRegular = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: 'VIP 常客' } });
  const segGoldRegular = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: 'GOLD 常客' } });
  const segPotential = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: '潛力會員' } });
  const segSilverPlus = await prisma.segment.findFirst({ where: { merchantId: merchant.id, name: '銀卡以上' } });
  if (segVipRegular && coup50) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: 'VIP 常客發折 50 券', segmentId: segVipRegular.id, couponId: coup50.id, enabled: true, scheduleType: 'weekly', nextRunAt: new Date(now.getTime() + 3 * 86400000) },
    });
  }
  if (segGoldRegular && coup20) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: 'GOLD 常客發折 20 券', segmentId: segGoldRegular.id, couponId: coup20.id, enabled: true, scheduleType: 'weekly', nextRunAt: new Date(now.getTime() + 5 * 86400000) },
    });
  }
  if (segPotential && coupWelcome) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: '潛力會員發歡迎券', segmentId: segPotential.id, couponId: coupWelcome.id, enabled: true, scheduleType: 'daily', nextRunAt: new Date(now.getTime() + 2 * 86400000) },
    });
  }
  if (segSilverPlus && coup30) {
    await prisma.crmCouponDispatchRule.create({
      data: { merchantId: merchant.id, name: '銀卡以上發節慶券', segmentId: segSilverPlus.id, couponId: coup30.id, enabled: true, scheduleType: 'weekly', nextRunAt: new Date(now.getTime() + 7 * 86400000) },
    });
  }
  /** 發券紀錄：加倍，Customer ↔ LoyaltyCoupon 關聯涵蓋更多會員（使用實際存在的 code：VIP002/MEM019 為 GOLD） */
  const custForCoupon = await prisma.customer.findMany({
    where: { merchantId: merchant.id, code: { in: ['VIP001', 'VIP002', 'MEM005', 'MEM010', 'MEM017', 'MEM018', 'MEM019', 'MEM020'] } },
  });
  if (coupWelcome) {
    for (const v of custForCoupon.filter((x) => x.code && ['VIP001', 'MEM005', 'MEM017', 'MEM019'].includes(x.code))) {
      await prisma.loyaltyCouponIssue.create({ data: { customerId: v.id, couponId: coupWelcome.id } }).catch(() => {});
    }
  }
  if (coup50) {
    for (const c of custForCoupon.filter((x) => x.code && ['VIP001', 'VIP002', 'MEM005', 'MEM010'].includes(x.code))) {
      await prisma.loyaltyCouponIssue.create({ data: { customerId: c.id, couponId: coup50.id } }).catch(() => {});
    }
  }
  if (coup20) {
    for (const c of custForCoupon.filter((x) => x.code && ['VIP002', 'MEM019', 'MEM018', 'MEM020'].includes(x.code))) {
      await prisma.loyaltyCouponIssue.create({ data: { customerId: c.id, couponId: coup20.id } }).catch(() => {});
    }
  }
  if (coup30) {
    for (const c of custForCoupon.filter((x) => x.code && ['VIP001', 'VIP002', 'MEM017'].includes(x.code))) {
      await prisma.loyaltyCouponIssue.create({ data: { customerId: c.id, couponId: coup30.id } }).catch(() => {});
    }
  }
  /** CrmMarketingJob 示範：供 /admin/crm/jobs 行銷工作台列表展示 */
  if (segVipCreated && coup50) {
    await prisma.crmMarketingJob.create({
      data: {
        merchantId: merchant.id,
        kind: 'segment-coupon',
        segmentId: segVipCreated.id,
        couponId: coup50.id,
        status: 'done',
        resultJson: JSON.stringify({ sent: 4, skipped: 0, errors: [] }),
        error: null,
      },
    });
  }
  if (segAllCreated && coupWelcome) {
    await prisma.crmMarketingJob.create({
      data: {
        merchantId: merchant.id,
        kind: 'segment-coupon',
        segmentId: segAllCreated.id,
        couponId: coupWelcome.id,
        status: 'done',
        resultJson: JSON.stringify({ sent: 2, skipped: 1, errors: [] }),
        error: null,
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
    /** 賒帳時僅建 SALE_RECEIVABLE，不建 SALE_PAYMENT，供應收餘額展示 */
    creditOnly?: boolean;
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
    if (!args.creditOnly) {
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
    }
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
    creditOnly: true,
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
  const order014 = await posSale({ orderNumber: `DEMO-POS-${y}-014`, customerId: custMem8.id, subtotal: 350, discount: 0, total: 350, method: 'CASH', occurredAt: daysAgo(22), lines: [{ productId: pHay.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 25 }], note: '中單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-015`, subtotal: 150, discount: 0, total: 150, method: 'CASH', occurredAt: daysAgo(24), lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }], note: '匿名客' });
  const order016 = await posSale({ orderNumber: `DEMO-POS-${y}-016`, customerId: custMem9.id, subtotal: 750, discount: 50, total: 700, method: 'CASH', occurredAt: daysAgo(26), lines: [{ productId: pFeed.id, qty: 2, unitPrice: 280 }, { productId: pBowl.id, qty: 2, unitPrice: 95 }], note: '高單' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-017`, subtotal: 199, discount: 0, total: 199, method: 'CASH', occurredAt: daysAgo(28), lines: [{ productId: pTeeW.id, qty: 1, unitPrice: 150 }, { productId: pSnack.id, qty: 1, unitPrice: 49 }], note: '匿名' });
  const order018 = await posSale({ orderNumber: `DEMO-POS-${y}-018`, customerId: custMem10.id, subtotal: 1099, discount: 0, total: 1099, method: 'CASH', occurredAt: daysAgo(30), lines: [{ productId: pCageS.id, qty: 1, unitPrice: 1099 }], note: '高單兔籠' });
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
  /** 加倍：更多 POS 訂單 031～060 */
  const custMem17 = await c('MEM017');
  const custMem20 = await c('MEM020');
  const custMem25 = await c('MEM025');
  const custMem30 = await c('MEM030');
  await posSale({ orderNumber: `DEMO-POS-${y}-031`, customerId: custMem17.id, subtotal: 199, discount: 0, total: 199, method: 'CASH', occurredAt: daysAgo(3), lines: [{ productId: pTeeW.id, qty: 1, unitPrice: 150 }, { productId: pSnack.id, qty: 1, unitPrice: 49 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-032`, subtotal: 280, discount: 0, total: 280, method: 'CASH', occurredAt: daysAgo(8), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-033`, customerId: custMem20.id, subtotal: 447, discount: 0, total: 447, method: 'CASH', occurredAt: daysAgo(11), lines: [{ productId: pHay.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 49 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-034`, customerId: custGold.id, subtotal: 598, discount: 0, total: 598, method: 'CARD', occurredAt: daysAgo(15), lines: [{ productId: pHay.id, qty: 4, unitPrice: 149 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-035`, subtotal: 249, discount: 0, total: 249, method: 'CASH', occurredAt: daysAgo(17), lines: [{ productId: pToyTunnel.id, qty: 1, unitPrice: 249 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-036`, customerId: custMem25.id, subtotal: 379, discount: 0, total: 379, method: 'CASH', occurredAt: daysAgo(19), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }, { productId: pBowl.id, qty: 1, unitPrice: 99 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-037`, customerId: custMem1.id, subtotal: 129, discount: 0, total: 129, method: 'CASH', occurredAt: daysAgo(23), lines: [{ productId: pBottle.id, qty: 1, unitPrice: 129 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-038`, subtotal: 349, discount: 0, total: 349, method: 'CASH', occurredAt: daysAgo(27), lines: [{ productId: pHay.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 24 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-039`, customerId: custMem30.id, subtotal: 528, discount: 0, total: 528, method: 'CASH', occurredAt: daysAgo(31), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }, { productId: pHay.id, qty: 1, unitPrice: 150 }, { productId: pBowl.id, qty: 1, unitPrice: 98 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-040`, customerId: custVip!.id, subtotal: 1099, discount: 0, total: 1099, method: 'CARD', occurredAt: daysAgo(35), lines: [{ productId: pCageS.id, qty: 1, unitPrice: 1099 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-041`, subtotal: 75, discount: 0, total: 75, method: 'CASH', occurredAt: daysAgo(37), lines: [{ productId: pToyBall.id, qty: 1, unitPrice: 20 }, { productId: pSnack.id, qty: 1, unitPrice: 55 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-042`, customerId: custMem3.id, subtotal: 450, discount: 0, total: 450, method: 'CASH', occurredAt: daysAgo(41), lines: [{ productId: pTeeW.id, qty: 3, unitPrice: 150 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-043`, customerId: custMem7.id, subtotal: 198, discount: 0, total: 198, method: 'CASH', occurredAt: daysAgo(43), lines: [{ productId: pBowl.id, qty: 2, unitPrice: 99 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-044`, subtotal: 1699, discount: 0, total: 1699, method: 'CARD', occurredAt: daysAgo(45), lines: [{ productId: pCageL.id, qty: 1, unitPrice: 1699 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-045`, customerId: custMem8.id, subtotal: 278, discount: 0, total: 278, method: 'CASH', occurredAt: daysAgo(47), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 278 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-046`, customerId: custMem9.id, subtotal: 320, discount: 0, total: 320, method: 'CASH', occurredAt: daysAgo(51), lines: [{ productId: pFeed.id, qty: 1, unitPrice: 280 }, { productId: pSnack.id, qty: 1, unitPrice: 40 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-047`, subtotal: 150, discount: 0, total: 150, method: 'CASH', occurredAt: daysAgo(53), lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-048`, customerId: custMem10.id, subtotal: 498, discount: 0, total: 498, method: 'CASH', occurredAt: daysAgo(55), lines: [{ productId: pHay.id, qty: 2, unitPrice: 150 }, { productId: pBottle.id, qty: 2, unitPrice: 99 }], note: '' });
  await posSale({ orderNumber: `DEMO-POS-${y}-049`, customerId: custMem2.id, subtotal: 99, discount: 0, total: 99, method: 'CASH', occurredAt: daysAgo(57), lines: [{ productId: pBowl.id, qty: 1, unitPrice: 99 }], note: '' });
  await posSaleGuest({ orderNumber: `DEMO-POS-${y}-050`, subtotal: 399, discount: 0, total: 399, method: 'CASH', occurredAt: daysAgo(59), lines: [{ productId: pTee.id, qty: 2, unitPrice: 150 }, { productId: pSnack.id, qty: 2, unitPrice: 49 }], note: '' });
  /** 補貨建議示範：DEMO-LOW-STOCK 售出 1 單位，庫存歸零，供 AdminReplenishmentPage */
  await posSale({ orderNumber: `DEMO-POS-${y}-REPL`, customerId: custVip!.id, subtotal: 50, discount: 0, total: 50, method: 'CASH', occurredAt: daysAgo(10), lines: [{ productId: pLowStock.id, qty: 1, unitPrice: 50 }], note: 'POS DEMO-POS-REPL 補貨建議示範' });
  /** 報表時間區段：today/last7d/last30d 至少 5 筆，供 preset 篩選有內容 */
  const orderT1 = await posSale({ orderNumber: `DEMO-POS-${y}-T1`, customerId: custVip!.id, subtotal: 150, discount: 0, total: 150, method: 'CASH', occurredAt: daysAgo(0), lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }], note: '今日' });
  const orderT2 = await posSale({ orderNumber: `DEMO-POS-${y}-T2`, customerId: custGold.id, subtotal: 298, discount: 0, total: 298, method: 'CASH', occurredAt: daysAgo(1), lines: [{ productId: pHay.id, qty: 2, unitPrice: 149 }], note: '近7日' });
  const orderT3 = await posSaleGuest({ orderNumber: `DEMO-POS-${y}-T3`, subtotal: 99, discount: 0, total: 99, method: 'CASH', occurredAt: daysAgo(2), lines: [{ productId: pBowl.id, qty: 1, unitPrice: 99 }], note: '近7日' });
  const orderT4 = await posSale({ orderNumber: `DEMO-POS-${y}-T4`, customerId: custMem1.id, subtotal: 198, discount: 0, total: 198, method: 'CASH', occurredAt: daysAgo(3), lines: [{ productId: pBowl.id, qty: 2, unitPrice: 99 }], note: '近7日' });
  const orderT5 = await posSale({ orderNumber: `DEMO-POS-${y}-T5`, customerId: custMem2.id, subtotal: 150, discount: 0, total: 150, method: 'CASH', occurredAt: daysAgo(5), lines: [{ productId: pTee.id, qty: 1, unitPrice: 150 }], note: '近7日' });
  /**
   * 共構分析用大量訂單：加大樣本量（分散近 60 天）。
   * - 先補庫存，避免大量 SALE_OUT 造成負庫存。
   * - 混合會員與匿名客，保留會員貢獻、付款方式、分類分布的可觀察性。
   */
  await addBalanceIncrement(pHay.id, 1200, 'SEED-BULK-ANALYTICS', '共構分析大量訂單補庫：牧草', daysAgo(60));
  await addBalanceIncrement(pBowl.id, 1200, 'SEED-BULK-ANALYTICS', '共構分析大量訂單補庫：食盆', daysAgo(60));
  await addBalanceIncrement(pSnack.id, 1200, 'SEED-BULK-ANALYTICS', '共構分析大量訂單補庫：零食', daysAgo(60));
  await addBalanceIncrement(pBottle.id, 1200, 'SEED-BULK-ANALYTICS', '共構分析大量訂單補庫：水壺', daysAgo(60));
  await addBalanceIncrement(pFeed.id, 1200, 'SEED-BULK-ANALYTICS', '共構分析大量訂單補庫：飼料', daysAgo(60));

  const analyticsOrderCount = 300;
  const analyticsCustomers = [
    custVip!.id,
    custGold.id,
    custMem1.id,
    custMem2.id,
    custMem3.id,
    custMem5.id,
    custMem6.id,
    custMem7.id,
    custMem8.id,
    custMem9.id,
    custMem10.id,
    custMem17.id,
    custMem20.id,
    custMem25.id,
    custMem30.id,
  ];
  const analyticsProducts = [
    { productId: pHay.id, price: 150 },
    { productId: pBowl.id, price: 99 },
    { productId: pSnack.id, price: 49 },
    { productId: pBottle.id, price: 129 },
    { productId: pFeed.id, price: 280 },
  ];
  for (let i = 0; i < analyticsOrderCount; i++) {
    const item = analyticsProducts[i % analyticsProducts.length]!;
    const qty = i % 4 === 0 ? 2 : 1;
    const subtotal = item.price * qty;
    const discount = i % 10 === 0 ? Math.min(20, Math.floor(subtotal * 0.05)) : 0;
    const total = subtotal - discount;
    const method = i % 5 === 0 ? 'CARD' : 'CASH';
    const occurredAt = new Date(daysAgo(i % 60).getTime() + (i % 12) * 3600000 + (i % 60) * 60000);
    const orderNumber = `DEMO-POS-${y}-MASS-${String(i + 1).padStart(3, '0')}`;
    const lines = [{ productId: item.productId, qty, unitPrice: item.price }];
    if (i % 4 === 0) {
      await posSaleGuest({
        orderNumber,
        subtotal,
        discount,
        total,
        method,
        occurredAt,
        lines,
        note: '共構分析樣本（匿名）',
      });
    } else {
      await posSale({
        orderNumber,
        customerId: analyticsCustomers[i % analyticsCustomers.length]!,
        subtotal,
        discount,
        total,
        method,
        occurredAt,
        lines,
        note: '共構分析樣本（會員）',
      });
    }
  }
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
    { customerId: custMem1.id, type: 'BURNED', amount: 1, balanceAfter: 1, referenceId: null, note: '兌換折 1 點（seed）', createdAt: ts(7, 0) },
    { customerId: custMem2.id, type: 'BURNED', amount: 1, balanceAfter: 2, referenceId: null, note: '結帳折抵 1 點（seed）', createdAt: ts(9, 0) },
    { customerId: custMem5.id, type: 'BURNED', amount: 1, balanceAfter: 4, referenceId: null, note: '兌換折 1 點（seed）', createdAt: ts(17, 0) },
    { customerId: custMem1.id, type: 'EARNED', amount: 1, balanceAfter: 1, referenceId: orderMem1a.id, note: `贈點 ${orderMem1a.orderNumber}`, createdAt: ts(4) },
    { customerId: custMem1.id, type: 'EARNED', amount: 1, balanceAfter: 2, referenceId: orderMem1b.id, note: `贈點 ${orderMem1b.orderNumber}`, createdAt: ts(6) },
    { customerId: custMem2.id, type: 'EARNED', amount: 3, balanceAfter: 3, referenceId: orderMem2.id, note: `贈點 ${orderMem2.orderNumber}`, createdAt: ts(8) },
    { customerId: custMem3.id, type: 'EARNED', amount: 2, balanceAfter: 2, referenceId: orderMem3.id, note: `贈點 ${orderMem3.orderNumber}`, createdAt: ts(10) },
    { customerId: custMem5.id, type: 'EARNED', amount: 1, balanceAfter: 1, referenceId: orderMem5a.id, note: `贈點 ${orderMem5a.orderNumber}`, createdAt: ts(12) },
    { customerId: custMem5.id, type: 'EARNED', amount: 1, balanceAfter: 2, referenceId: orderMem5b.id, note: `贈點 ${orderMem5b.orderNumber}`, createdAt: ts(14) },
    { customerId: custMem5.id, type: 'EARNED', amount: 3, balanceAfter: 5, referenceId: orderMem5c.id, note: `贈點 ${orderMem5c.orderNumber}`, createdAt: ts(16) },
    { customerId: custMem5.id, type: 'EXPIRED', amount: 1, balanceAfter: 3, referenceId: null, note: '效期到期沖銷 1 點（seed 示範）', createdAt: ts(18, 0) },
    { customerId: custMem6.id, type: 'EARNED', amount: 4, balanceAfter: 4, referenceId: orderMem6.id, note: `贈點 ${orderMem6.orderNumber}`, createdAt: ts(18) },
    { customerId: custMem6.id, type: 'BURNED', amount: 3, balanceAfter: 1, referenceId: null, note: '兌換折 3 點（seed）', createdAt: ts(18, 60) },
    { customerId: custMem8.id, type: 'EARNED', amount: 3, balanceAfter: 3, referenceId: order014.id, note: `贈點 ${order014.orderNumber}`, createdAt: ts(22) },
    { customerId: custMem9.id, type: 'EARNED', amount: 7, balanceAfter: 7, referenceId: order016.id, note: `贈點 ${order016.orderNumber}`, createdAt: ts(26) },
    { customerId: custMem10.id, type: 'EARNED', amount: 10, balanceAfter: 10, referenceId: order018.id, note: `贈點 ${order018.orderNumber}`, createdAt: ts(30) },
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

  /** 銷售退貨：10 筆（加倍）RETURN_FROM_CUSTOMER + SALE_REFUND，分散 today/last7d/last30d */
  const salesReturns: { orderId: string; orderNum: string; productId: string; qty: number; amount: number; custId: string; at: Date }[] = [
    { orderId: orderMem2.id, orderNum: orderMem2.orderNumber, productId: pTeeW.id, qty: 1, amount: 150, custId: custMem2.id, at: daysAgo(7) },
    { orderId: orderMem1a.id, orderNum: orderMem1a.orderNumber, productId: pBowl.id, qty: 1, amount: 99, custId: custMem1.id, at: daysAgo(12) },
    { orderId: orderGold.id, orderNum: orderGold.orderNumber, productId: pTee.id, qty: 1, amount: 150, custId: custGold.id, at: daysAgo(15) },
    { orderId: orderMem5a.id, orderNum: orderMem5a.orderNumber, productId: pTee.id, qty: 1, amount: 150, custId: custMem5.id, at: daysAgo(20) },
    { orderId: orderT2.id, orderNum: orderT2.orderNumber, productId: pHay.id, qty: 1, amount: 149, custId: custGold.id, at: daysAgo(2) },
    { orderId: orderMem3.id, orderNum: orderMem3.orderNumber, productId: pFeed.id, qty: 1, amount: 280, custId: custMem3.id, at: daysAgo(4) },
    { orderId: orderMem6.id, orderNum: orderMem6.orderNumber, productId: pBowl.id, qty: 1, amount: 100, custId: custMem6.id, at: daysAgo(10) },
    { orderId: orderMem1b.id, orderNum: orderMem1b.orderNumber, productId: pTee.id, qty: 1, amount: 150, custId: custMem1.id, at: daysAgo(8) },
    { orderId: order014.id, orderNum: order014.orderNumber, productId: pHay.id, qty: 1, amount: 150, custId: custMem8.id, at: daysAgo(14) },
    { orderId: order016.id, orderNum: order016.orderNumber, productId: pBowl.id, qty: 1, amount: 95, custId: custMem9.id, at: daysAgo(18) },
  ];
  for (const r of salesReturns) {
    await prisma.inventoryEvent.create({
      data: {
        productId: r.productId,
        warehouseId: warehouse.id,
        type: 'RETURN_FROM_CUSTOMER',
        quantity: r.qty,
        occurredAt: r.at,
        referenceId: r.orderId,
        note: `銷售退貨 ${r.orderNum} 退 ${r.qty} 件`,
      },
    });
    await prisma.inventoryBalance.update({
      where: { productId_warehouseId: { productId: r.productId, warehouseId: warehouse.id } },
      data: { onHandQty: { increment: r.qty } },
    });
    await prisma.financeEvent.create({
      data: {
        type: 'SALE_REFUND',
        partyId: `customer:${r.custId}`,
        currency: 'TWD',
        amount: r.amount,
        taxAmount: 0,
        occurredAt: r.at,
        referenceId: r.orderId,
        note: `SALE_REFUND ${r.orderNum} 退 ${r.qty} 件`,
      },
    });
  }

  /** 換貨：orderMem3（飼料 280）→ 新單（牧草 150），exchangeFromOrderId + SALE_REFUND 差額 */
  const exchangeAt = daysAgo(9);
  const orderExchange = await prisma.posOrder.create({
    data: {
      orderNumber: `DEMO-POS-${y}-EXCHANGE`,
      storeId: store.id,
      customerId: custMem3.id,
      exchangeFromOrderId: orderMem3.id,
      subtotalAmount: 150,
      discountAmount: 0,
      totalAmount: 150,
      createdAt: exchangeAt,
      items: { create: [{ productId: pHay.id, quantity: 1, unitPrice: 150 }] },
    },
  });
  await prisma.posOrderPayment.create({
    data: { orderId: orderExchange.id, method: 'CASH', amount: 150 },
  });
  await prisma.inventoryEvent.create({
    data: {
      productId: pHay.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: -1,
      occurredAt: exchangeAt,
      referenceId: orderExchange.id,
      note: `換貨新單 ${orderExchange.orderNumber}`,
    },
  });
  await prisma.inventoryBalance.update({
    where: { productId_warehouseId: { productId: pHay.id, warehouseId: warehouse.id } },
    data: { onHandQty: { decrement: 1 } },
  });
  await prisma.inventoryEvent.create({
    data: {
      productId: pFeed.id,
      warehouseId: warehouse.id,
      type: 'RETURN_FROM_CUSTOMER',
      quantity: 1,
      occurredAt: exchangeAt,
      referenceId: orderMem3.id,
      note: `換貨退原品 ${orderMem3.orderNumber}`,
    },
  });
  await prisma.inventoryBalance.update({
    where: { productId_warehouseId: { productId: pFeed.id, warehouseId: warehouse.id } },
    data: { onHandQty: { increment: 1 } },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'SALE_REFUND',
      partyId: `customer:${custMem3.id}`,
      currency: 'TWD',
      amount: 130,
      taxAmount: 0,
      occurredAt: exchangeAt,
      referenceId: orderMem3.id,
      note: `SALE_REFUND 換貨差額 ${orderMem3.orderNumber} → ${orderExchange.orderNumber}`,
    },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'SALE_RECEIVABLE',
      partyId: `customer:${custMem3.id}`,
      currency: 'TWD',
      amount: 150,
      taxAmount: 0,
      occurredAt: exchangeAt,
      referenceId: orderExchange.id,
      note: `POS ${orderExchange.orderNumber} 應收`,
    },
  });
  await prisma.financeEvent.create({
    data: {
      type: 'SALE_PAYMENT',
      partyId: `customer:${custMem3.id}`,
      currency: 'TWD',
      amount: 150,
      taxAmount: 0,
      occurredAt: exchangeAt,
      referenceId: orderExchange.id,
      note: `POS ${orderExchange.orderNumber} 實收`,
    },
  });
  await prisma.pointLedger.create({
    data: {
      merchantId: merchant.id,
      customerId: custMem3.id,
      type: 'EARNED',
      amount: 1,
      balanceAfter: 3,
      txnCode: 'SALE',
      referenceId: orderExchange.id,
      note: `贈點 ${orderExchange.orderNumber}（換貨新單）`,
      createdAt: exchangeAt,
    },
  });

  /** 換貨：再加 8 筆（加倍），共 9 筆，分散時間 */
  const exchanges: {
    srcOrder: typeof orderMem1b;
    newProductId: string;
    newQty: number;
    newPrice: number;
    returnProductId: string;
    returnQty: number;
    refundDelta: number;
    custId: string;
    at: Date;
  }[] = [
    { srcOrder: orderMem1b, newProductId: pBowl.id, newQty: 1, newPrice: 99, returnProductId: pTee.id, returnQty: 1, refundDelta: 51, custId: custMem1.id, at: daysAgo(11) },
    { srcOrder: orderMem2, newProductId: pSnack.id, newQty: 1, newPrice: 65, returnProductId: pTeeW.id, returnQty: 1, refundDelta: 85, custId: custMem2.id, at: daysAgo(13) },
    { srcOrder: orderMem5a, newProductId: pBottle.id, newQty: 1, newPrice: 129, returnProductId: pTee.id, returnQty: 1, refundDelta: 21, custId: custMem5.id, at: daysAgo(18) },
    { srcOrder: order014, newProductId: pBowl.id, newQty: 1, newPrice: 99, returnProductId: pHay.id, returnQty: 1, refundDelta: 51, custId: custMem8.id, at: daysAgo(24) },
    { srcOrder: order1b, newProductId: pBottle.id, newQty: 1, newPrice: 129, returnProductId: pTee.id, returnQty: 1, refundDelta: 21, custId: custVip!.id, at: daysAgo(2) },
    { srcOrder: orderGold, newProductId: pSnack.id, newQty: 1, newPrice: 65, returnProductId: pTee.id, returnQty: 1, refundDelta: 85, custId: custGold.id, at: daysAgo(16) },
    { srcOrder: order016, newProductId: pSnack.id, newQty: 1, newPrice: 65, returnProductId: pBowl.id, returnQty: 1, refundDelta: 30, custId: custMem9.id, at: daysAgo(27) },
    { srcOrder: orderMem6, newProductId: pBottle.id, newQty: 1, newPrice: 129, returnProductId: pTee.id, returnQty: 1, refundDelta: 21, custId: custMem6.id, at: daysAgo(19) },
  ];
  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    const ordEx = await prisma.posOrder.create({
      data: {
        orderNumber: `DEMO-POS-${y}-EX${i + 2}`,
        storeId: store.id,
        customerId: ex.custId,
        exchangeFromOrderId: ex.srcOrder.id,
        subtotalAmount: ex.newPrice * ex.newQty,
        discountAmount: 0,
        totalAmount: ex.newPrice * ex.newQty,
        createdAt: ex.at,
        items: { create: [{ productId: ex.newProductId, quantity: ex.newQty, unitPrice: ex.newPrice }] },
      },
    });
    await prisma.posOrderPayment.create({ data: { orderId: ordEx.id, method: 'CASH', amount: ex.newPrice * ex.newQty } });
    await prisma.inventoryEvent.create({
      data: { productId: ex.newProductId, warehouseId: warehouse.id, type: 'SALE_OUT', quantity: -ex.newQty, occurredAt: ex.at, referenceId: ordEx.id, note: `換貨新單 ${ordEx.orderNumber}` },
    });
    await prisma.inventoryBalance.update({
      where: { productId_warehouseId: { productId: ex.newProductId, warehouseId: warehouse.id } },
      data: { onHandQty: { decrement: ex.newQty } },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: ex.returnProductId,
        warehouseId: warehouse.id,
        type: 'RETURN_FROM_CUSTOMER',
        quantity: ex.returnQty,
        occurredAt: ex.at,
        referenceId: ex.srcOrder.id,
        note: `換貨退原品 ${ex.srcOrder.orderNumber}`,
      },
    });
    await prisma.inventoryBalance.update({
      where: { productId_warehouseId: { productId: ex.returnProductId, warehouseId: warehouse.id } },
      data: { onHandQty: { increment: ex.returnQty } },
    });
    if (ex.refundDelta > 0) {
      await prisma.financeEvent.create({
        data: {
          type: 'SALE_REFUND',
          partyId: `customer:${ex.custId}`,
          currency: 'TWD',
          amount: ex.refundDelta,
          taxAmount: 0,
          occurredAt: ex.at,
          referenceId: ex.srcOrder.id,
          note: `SALE_REFUND 換貨差額 ${ex.srcOrder.orderNumber} → ${ordEx.orderNumber}`,
        },
      });
    }
    await prisma.financeEvent.createMany({
      data: [
        { type: 'SALE_RECEIVABLE', partyId: `customer:${ex.custId}`, currency: 'TWD', amount: ex.newPrice * ex.newQty, taxAmount: 0, occurredAt: ex.at, referenceId: ordEx.id, note: `POS ${ordEx.orderNumber} 應收` },
        { type: 'SALE_PAYMENT', partyId: `customer:${ex.custId}`, currency: 'TWD', amount: ex.newPrice * ex.newQty, taxAmount: 0, occurredAt: ex.at, referenceId: ordEx.id, note: `POS ${ordEx.orderNumber} 實收` },
      ],
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
  /** 加倍：更多促銷規則 */
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: '滿 500 折 50',
      priority: 3,
      draft: false,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [{ type: 'SPEND', op: '>=', value: 500 }],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 50 }],
    },
  });
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: '滿 200 折 20',
      priority: 4,
      draft: false,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [{ type: 'SPEND', op: '>=', value: 200 }],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 20 }],
    },
  });
  await prisma.promotionRule.create({
    data: {
      merchantId: merchant.id,
      name: '草稿促銷二（未上架）',
      priority: 98,
      draft: true,
      startsAt: yearStart,
      endsAt: yearEnd,
      conditions: [{ type: 'SPEND', op: '>=', value: 300 }],
      actions: [{ type: 'WHOLE_PERCENT', percentOff: 5 }],
    },
  });

  /** 促銷／折價券關聯：訂單 promotionApplied、PromotionRule.usageCount、LoyaltyCoupon.usedCount */
  const promoRule1 = await prisma.promotionRule.findFirst({
    where: { merchantId: merchant.id, name: '滿百折十（小計100→折10）' },
  });
  const promoRule2 = await prisma.promotionRule.findFirst({
    where: { merchantId: merchant.id, name: '全館滿千折百' },
  });
  if (promoRule1) {
    await prisma.posOrder.updateMany({
      where: { orderNumber: { in: [`DEMO-POS-${y}-001`, `DEMO-POS-${y}-011`, `DEMO-POS-${y}-023`] } },
      data: {
        promotionApplied: {
          ruleId: promoRule1.id,
          ruleName: '滿百折十',
          applied: [{ type: 'WHOLE_FIXED', off: 10 }],
        },
      },
    });
    await prisma.promotionRule.update({
      where: { id: promoRule1.id },
      data: { usageCount: { increment: 3 } },
    });
  }
  if (promoRule2) {
    await prisma.posOrder.updateMany({
      where: { orderNumber: { in: [`DEMO-POS-${y}-016`, `DEMO-POS-${y}-025`] } },
      data: {
        promotionApplied: {
          ruleId: promoRule2.id,
          ruleName: '全館滿千折百',
          applied: [{ type: 'WHOLE_FIXED', off: 100 }],
        },
      },
    });
    await prisma.promotionRule.update({
      where: { id: promoRule2.id },
      data: { usageCount: { increment: 2 } },
    });
  }
  await prisma.loyaltyCoupon.update({
    where: { merchantId_code: { merchantId: merchant.id, code: 'VIP50' } },
    data: { usedCount: 1 },
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
  await prisma.bulkImportJob.create({
    data: {
      kind: 'products_csv',
      status: 'done',
      resultJson: JSON.stringify({ ok: 5, failed: 1 }),
    },
  });
  await prisma.bulkImportJob.create({
    data: {
      kind: 'customers_csv',
      status: 'failed',
      error: '重複 phone 欄位',
      resultJson: null,
    },
  });

  /** OpsJobRunLog 示範：供 /admin/ops/jobs Job 監控頁列表展示 */
  await prisma.opsJobRunLog.createMany({
    data: [
      { jobType: 'finance-snapshot', lastRunAt: daysAgo(1), success: true, message: null },
      { jobType: 'crm-run-scheduled', lastRunAt: daysAgo(2), success: true, message: null },
      { jobType: 'finance-snapshot', lastRunAt: daysAgo(3), success: true, message: null },
      { jobType: 'finance-period-close', lastRunAt: daysAgo(5), success: true, message: null },
      { jobType: 'crm-run-scheduled', lastRunAt: daysAgo(7), success: false, message: '部分會員無電話略過' },
    ],
  });

  /** 金流快照：10 筆（加倍），由實際 FinanceEvent 彙總，供 /admin/finance/snapshots 與金流報表數據一致 */
  const snapshotDates = [order1Occurred, daysAgo(3), daysAgo(7), daysAgo(10), daysAgo(14), daysAgo(18), daysAgo(21), daysAgo(25), daysAgo(28), daysAgo(35)];
  for (const d of snapshotDates) {
    const sd = new Date(d);
    sd.setUTCHours(0, 0, 0, 0);
    const snapFrom = new Date(sd);
    const snapTo = new Date(sd);
    snapTo.setUTCDate(snapTo.getUTCDate() + 1);
    snapTo.setMilliseconds(-1);
    const [byTypeRows, byPartyRows] = await Promise.all([
      prisma.financeEvent.groupBy({ by: ['type'], where: { occurredAt: { gte: snapFrom, lte: snapTo } }, _sum: { amount: true } }),
      prisma.financeEvent.groupBy({ by: ['partyId', 'type'], where: { occurredAt: { gte: snapFrom, lte: snapTo } }, _sum: { amount: true } }),
    ]);
    const byType: Record<string, number> = {};
    for (const r of byTypeRows) byType[r.type] = Number(r._sum.amount ?? 0);
    const byPartyMap = new Map<string, Record<string, number>>();
    for (const r of byPartyRows) {
      if (!r.partyId) continue;
      const cur = byPartyMap.get(r.partyId) ?? {};
      cur[r.type] = Number(r._sum.amount ?? 0);
      byPartyMap.set(r.partyId, cur);
    }
    const byParty = Array.from(byPartyMap.entries()).map(([partyId, amountsByType]) => ({ partyId, amountsByType }));
    await prisma.financeSnapshot.create({
      data: {
        asOfDate: sd,
        type: 'daily',
        path: `finance/${sd.toISOString().slice(0, 10)}-daily.json`,
        summaryJson: { asOfDate: sd.toISOString().slice(0, 10), type: 'daily', generatedAt: new Date().toISOString(), byType, byParty } as object,
      },
    });
  }

  /** 關帳區間：2 筆 demo，供 /admin/finance/periods 展示 */
  const period1Start = new Date(y, 0, 1);
  const period1End = new Date(y, 0, 15, 23, 59, 59);
  const period2Start = new Date(y, 0, 16);
  const period2End = new Date(y, 0, 31, 23, 59, 59);
  await prisma.financePeriodClose.create({
    data: {
      merchantId: merchant.id,
      startDate: period1Start,
      endDate: period1End,
      closedBy: 'seed',
      status: 'CLOSED',
    },
  });
  await prisma.financePeriodClose.create({
    data: {
      merchantId: merchant.id,
      startDate: period2Start,
      endDate: period2End,
      closedBy: 'seed',
      status: 'CLOSED',
    },
  });

  /** 稽核紀錄：30 筆（加倍）對應部分 FinanceEvent，供 /admin/finance/audit-log 展示 */
  const sampleEvents = await prisma.financeEvent.findMany({
    take: 30,
    orderBy: { occurredAt: 'desc' },
  });
  for (const ev of sampleEvents) {
    await prisma.financeAuditLog.create({
      data: {
        eventId: ev.id,
        actor: 'seed',
        source: 'seed',
        amount: ev.amount,
        eventType: ev.type,
      },
    });
  }

  /** 報表穿透審計：referenceId 對應實際可穿透實體，source 與報表來源一致 */
  await prisma.reportClickAudit.create({
    data: {
      merchantId: merchant.id,
      source: 'finance-events',
      field: 'referenceId',
      referenceId: order1.id,
      resolvedKind: 'posOrder',
      success: true,
      resultCode: 'ok',
    },
  });
  await prisma.reportClickAudit.create({
    data: {
      merchantId: merchant.id,
      source: 'finance-events',
      field: 'referenceId',
      referenceId: rnFull.id,
      resolvedKind: 'receivingNote',
      success: true,
      resultCode: 'ok',
    },
  });
  await prisma.reportClickAudit.create({
    data: {
      merchantId: merchant.id,
      source: 'loyalty-ledger',
      field: 'referenceId',
      referenceId: order018.id,
      resolvedKind: 'posOrder',
      success: true,
      resultCode: 'ok',
    },
  });
  await prisma.reportClickAudit.create({
    data: {
      merchantId: merchant.id,
      source: 'pos-reports',
      field: 'referenceId',
      referenceId: orderExchange.id,
      resolvedKind: 'posOrder',
      success: true,
      resultCode: 'ok',
    },
  });
  await prisma.reportClickAudit.create({
    data: {
      merchantId: merchant.id,
      source: 'finance-events',
      field: 'referenceId',
      referenceId: rnPartial.id,
      resolvedKind: 'receivingNote',
      success: true,
      resultCode: 'ok',
    },
  });
  /** 加倍：更多報表穿透審計 */
  await prisma.reportClickAudit.create({
    data: { merchantId: merchant.id, source: 'finance-events', field: 'referenceId', referenceId: order014.id, resolvedKind: 'posOrder', success: true, resultCode: 'ok' },
  });
  await prisma.reportClickAudit.create({
    data: { merchantId: merchant.id, source: 'finance-events', field: 'referenceId', referenceId: order016.id, resolvedKind: 'posOrder', success: true, resultCode: 'ok' },
  });
  await prisma.reportClickAudit.create({
    data: { merchantId: merchant.id, source: 'pos-reports', field: 'referenceId', referenceId: order1b.id, resolvedKind: 'posOrder', success: true, resultCode: 'ok' },
  });
  await prisma.reportClickAudit.create({
    data: { merchantId: merchant.id, source: 'loyalty-ledger', field: 'referenceId', referenceId: orderGold.id, resolvedKind: 'posOrder', success: true, resultCode: 'ok' },
  });
  await prisma.reportClickAudit.create({
    data: { merchantId: merchant.id, source: 'finance-events', field: 'referenceId', referenceId: rnFull.id, resolvedKind: 'receivingNote', success: true, resultCode: 'ok' },
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
