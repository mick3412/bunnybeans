import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INITIAL_QTY = 100;

async function ensureInventory(
  prisma: PrismaClient,
  productId: string,
  warehouseId: string,
  now: Date,
) {
  const existing = await prisma.inventoryBalance.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId,
      },
    },
  });
  if (!existing) {
    await prisma.inventoryEvent.create({
      data: {
        productId,
        warehouseId,
        type: 'PURCHASE_IN',
        quantity: INITIAL_QTY,
        occurredAt: now,
        referenceId: 'SEED',
        note: 'Initial stock',
      },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
      create: {
        productId,
        warehouseId,
        onHandQty: INITIAL_QTY,
      },
      update: { onHandQty: INITIAL_QTY },
    });
  }
}

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { code: 'M001' },
    update: {},
    create: {
      code: 'M001',
      name: 'Demo 商家',
    },
  });

  const store = await prisma.store.upsert({
    where: { code: 'S001' },
    update: {},
    create: {
      code: 'S001',
      name: 'Demo 門市',
      merchantId: merchant.id,
    },
  });

  /** Playwright 掛帳 E2E 固定客戶 id；每次 upsert，與 code:C001 是否已存在無關 */
  const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';
  await prisma.customer.upsert({
    where: { id: E2E_CUSTOMER_ID },
    create: {
      id: E2E_CUSTOMER_ID,
      merchantId: merchant.id,
      code: 'E2E',
      name: 'E2E 掛帳測試',
      phone: '0900000001',
    },
    update: { merchantId: merchant.id },
  });
  const existingCustomer = await prisma.customer.findFirst({
    where: { merchantId: merchant.id, code: 'C001' },
  });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        code: 'C001',
        name: 'Demo 客戶',
        phone: '0900000000',
      },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'W001' },
    update: { storeId: store.id },
    create: {
      code: 'W001',
      name: 'Demo 門市倉',
      merchantId: merchant.id,
      storeId: store.id,
    },
  });

  const catClothes = await prisma.category.upsert({
    where: { code: 'cat-clothes' },
    update: {},
    create: { code: 'cat-clothes', name: '衣服' },
  });
  const catHay = await prisma.category.upsert({
    where: { code: 'cat-hay' },
    update: {},
    create: { code: 'cat-hay', name: '牧草' },
  });
  const catFeed = await prisma.category.upsert({
    where: { code: 'cat-feed' },
    update: {},
    create: { code: 'cat-feed', name: '飼料' },
  });
  const catSupplies = await prisma.category.upsert({
    where: { code: 'cat-supplies' },
    update: {},
    create: { code: 'cat-supplies', name: '用品' },
  });

  const brandHouse = await prisma.brand.upsert({
    where: { code: 'brand-house' },
    update: {},
    create: { code: 'brand-house', name: '自有品牌' },
  });
  const brandPremium = await prisma.brand.upsert({
    where: { code: 'brand-premium' },
    update: {},
    create: { code: 'brand-premium', name: '精選' },
  });
  const brandFeed = await prisma.brand.upsert({
    where: { code: 'brand-feed' },
    update: {},
    create: { code: 'brand-feed', name: '飼料牌' },
  });

  const now = new Date();

  const productsClothes = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'SKU-CLOTH-001' },
      update: {
        categoryId: catClothes.id,
        brandId: brandHouse.id,
        tags: ['熱銷'],
      },
      create: {
        sku: 'SKU-CLOTH-001',
        name: '短袖 T 恤',
        categoryId: catClothes.id,
        brandId: brandHouse.id,
        tags: ['熱銷'],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-CLOTH-002' },
      update: { categoryId: catClothes.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-CLOTH-002',
        name: '長袖工作服',
        categoryId: catClothes.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-CLOTH-003' },
      update: { categoryId: catClothes.id, brandId: brandPremium.id, tags: ['清倉'] },
      create: {
        sku: 'SKU-CLOTH-003',
        name: '寵物背心',
        categoryId: catClothes.id,
        brandId: brandPremium.id,
        tags: ['清倉'],
      },
    }),
  ]);

  const productsHay = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'SKU-HAY-001' },
      update: { categoryId: catHay.id, brandId: brandHouse.id, tags: ['熱銷', '新品'] },
      create: {
        sku: 'SKU-HAY-001',
        name: '提摩西牧草',
        categoryId: catHay.id,
        brandId: brandHouse.id,
        tags: ['熱銷', '新品'],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-HAY-002' },
      update: { categoryId: catHay.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-HAY-002',
        name: '果園草',
        categoryId: catHay.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-HAY-003' },
      update: { categoryId: catHay.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-HAY-003',
        name: '燕麥草',
        categoryId: catHay.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
  ]);

  const productsFeed = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'SKU-A001' },
      update: { categoryId: catFeed.id, brandId: brandFeed.id, tags: [] },
      create: {
        sku: 'SKU-A001',
        name: '商品 A',
        categoryId: catFeed.id,
        brandId: brandFeed.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-B002' },
      update: { categoryId: catFeed.id, brandId: brandFeed.id, tags: [] },
      create: {
        sku: 'SKU-B002',
        name: '商品 B',
        categoryId: catFeed.id,
        brandId: brandFeed.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-C003' },
      update: { categoryId: catFeed.id, brandId: brandFeed.id, tags: [] },
      create: {
        sku: 'SKU-C003',
        name: '商品 C',
        categoryId: catFeed.id,
        brandId: brandFeed.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-FEED-001' },
      update: { categoryId: catFeed.id, brandId: brandFeed.id, tags: ['熱銷'] },
      create: {
        sku: 'SKU-FEED-001',
        name: '成兔飼料',
        categoryId: catFeed.id,
        brandId: brandFeed.id,
        tags: ['熱銷'],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-FEED-002' },
      update: { categoryId: catFeed.id, brandId: brandFeed.id, tags: [] },
      create: {
        sku: 'SKU-FEED-002',
        name: '幼兔飼料',
        categoryId: catFeed.id,
        brandId: brandFeed.id,
        tags: [],
      },
    }),
  ]);

  const productsSupplies = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'SKU-SUP-001' },
      update: { categoryId: catSupplies.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-SUP-001',
        name: '水壺',
        categoryId: catSupplies.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-SUP-002' },
      update: { categoryId: catSupplies.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-SUP-002',
        name: '食盆',
        categoryId: catSupplies.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SKU-SUP-003' },
      update: { categoryId: catSupplies.id, brandId: brandHouse.id, tags: [] },
      create: {
        sku: 'SKU-SUP-003',
        name: '便盆',
        categoryId: catSupplies.id,
        brandId: brandHouse.id,
        tags: [],
      },
    }),
  ]);

  const allProducts = [
    ...productsClothes,
    ...productsHay,
    ...productsFeed,
    ...productsSupplies,
  ];

  for (const product of allProducts) {
    await ensureInventory(prisma, product.id, warehouse.id, now);
  }

  // 極端場景：兩樣商品庫存設為 1 與 0，供測試低庫存／缺貨（重複執行 seed 時僅在尚未設定時寫入）
  const productQty1 = productsSupplies[2]; // 便盆 SKU-SUP-003
  const productQty0 = productsClothes[2]; // 寵物背心 SKU-CLOTH-003
  const bal1 = await prisma.inventoryBalance.findUnique({
    where: {
      productId_warehouseId: { productId: productQty1.id, warehouseId: warehouse.id },
    },
  });
  const bal0 = await prisma.inventoryBalance.findUnique({
    where: {
      productId_warehouseId: { productId: productQty0.id, warehouseId: warehouse.id },
    },
  });
  if (bal1?.onHandQty !== 1) {
    await prisma.inventoryEvent.create({
      data: {
        productId: productQty1.id,
        warehouseId: warehouse.id,
        type: 'SALE_OUT',
        quantity: -(bal1?.onHandQty ?? INITIAL_QTY) + 1,
        occurredAt: now,
        referenceId: 'SEED',
        note: 'Edge case: set onHand to 1',
      },
    });
    await prisma.inventoryBalance.update({
      where: {
        productId_warehouseId: { productId: productQty1.id, warehouseId: warehouse.id },
      },
      data: { onHandQty: 1 },
    });
  }
  if (bal0?.onHandQty !== 0) {
    await prisma.inventoryEvent.create({
      data: {
        productId: productQty0.id,
        warehouseId: warehouse.id,
        type: 'SALE_OUT',
        quantity: -(bal0?.onHandQty ?? INITIAL_QTY),
        occurredAt: now,
        referenceId: 'SEED',
        note: 'Edge case: set onHand to 0',
      },
    });
    await prisma.inventoryBalance.update({
      where: {
        productId_warehouseId: { productId: productQty0.id, warehouseId: warehouse.id },
      },
      data: { onHandQty: 0 },
    });
  }

  console.log('Seed done. Merchant:', merchant.code, 'Store:', store.code, 'Warehouse:', warehouse.code);
  console.log(
    'Categories:',
    [catClothes, catHay, catFeed, catSupplies].map((c) => ({ code: c.code, name: c.name })),
  );
  console.log('Product count:', allProducts.length);
  console.log('Edge case stock: 1 =', productQty1.sku, productQty1.name, '| 0 =', productQty0.sku, productQty0.name);
  console.log('Product IDs for POS (sample):', allProducts.slice(0, 5).map((p) => ({ sku: p.sku, id: p.id })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
