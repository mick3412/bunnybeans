/**
 * Product CSV import integration test.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductModule } from './product.module';
import { ProductService } from './application/product.service';

describe('ProductService importFromCsvBuffer (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let productService: ProductService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        ProductModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    productService = app.get(ProductService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates new sku and updates existing; reports failed row', async () => {
    if (!process.env.DATABASE_URL) return;

    const skuNew = `IMP-NEW-${Date.now()}`;
    const skuUp = `IMP-UP-${Date.now()}`;
    await prisma.product.create({
      data: {
        sku: skuUp,
        name: 'Old Name',
        listPrice: 1,
        salePrice: 2,
      },
    });

    const csv = [
      'sku,name,salePrice,listPrice',
      `${skuNew},New Product,99,100`,
      `${skuUp},Updated Name,55,60`,
      ',no sku,',
    ].join('\n');

    const out = await productService.importFromCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(out.ok).toBe(2);
    expect(out.failed).toEqual([{ row: 4, reason: 'sku required' }]);

    const p1 = await prisma.product.findUnique({ where: { sku: skuNew } });
    expect(p1?.name).toBe('New Product');
    expect(Number(p1?.salePrice)).toBe(99);

    const p2 = await prisma.product.findUnique({ where: { sku: skuUp } });
    expect(p2?.name).toBe('Updated Name');
    expect(Number(p2?.salePrice)).toBe(55);

    await prisma.product.deleteMany({ where: { sku: { in: [skuNew, skuUp] } } });
  }, 15000);

  it('batchUpdatePrice updates salePrice for multiple products', async () => {
    if (!process.env.DATABASE_URL) return;

    const p1 = await prisma.product.create({
      data: { sku: `BATCH-P1-${Date.now()}`, name: 'Batch P1', salePrice: 10 },
    });
    const p2 = await prisma.product.create({
      data: { sku: `BATCH-P2-${Date.now()}`, name: 'Batch P2', salePrice: 20 },
    });

    const out = await productService.batchUpdatePrice([p1.id, p2.id], 88);
    expect(out.updated).toBe(2);

    const a1 = await prisma.product.findUnique({ where: { id: p1.id } });
    const a2 = await prisma.product.findUnique({ where: { id: p2.id } });
    expect(Number(a1?.salePrice)).toBe(88);
    expect(Number(a2?.salePrice)).toBe(88);

    await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
  }, 15000);

  it('batchUpdateTags supports add/set and validates input', async () => {
    if (!process.env.DATABASE_URL) return;

    const p1 = await prisma.product.create({
      data: { sku: `BT-P1-${Date.now()}`, name: 'BT P1', tags: ['a'] as any },
    });
    const p2 = await prisma.product.create({
      data: { sku: `BT-P2-${Date.now()}`, name: 'BT P2', tags: [] as any },
    });
    try {
      const addOut = await productService.batchUpdateTags([p1.id, p2.id], ['b', 'c'], 'add');
      expect(addOut.updated).toBeGreaterThanOrEqual(1);

      const a1 = await prisma.product.findUnique({ where: { id: p1.id }, select: { tags: true } });
      const a2 = await prisma.product.findUnique({ where: { id: p2.id }, select: { tags: true } });
      expect(Array.isArray(a1?.tags)).toBe(true);
      expect(Array.isArray(a2?.tags)).toBe(true);

      const setOut = await productService.batchUpdateTags([p1.id], ['z'], 'set');
      expect(setOut.updated).toBe(1);
      const s1 = await prisma.product.findUnique({ where: { id: p1.id }, select: { tags: true } });
      expect(s1?.tags).toEqual(['z']);

      await expect(productService.batchUpdateTags([], ['x'], 'add')).rejects.toMatchObject({
        response: { code: 'PRODUCT_BATCH_EMPTY' },
      });
      await expect(productService.batchUpdateTags([p1.id], [], 'add')).rejects.toMatchObject({
        response: { code: 'PRODUCT_BATCH_INVALID' },
      });
      await expect(productService.batchUpdateTags([p1.id], ['x'], 'oops' as any)).rejects.toMatchObject({
        response: { code: 'PRODUCT_BATCH_INVALID' },
      });
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    }
  }, 15000);

  it('exportProductsCsv respects minDaysUntilExpiry and supports computed expiryDate', async () => {
    if (!process.env.DATABASE_URL) return;

    const skuOk = `EXP-OK-${Date.now()}`;
    const skuNo = `EXP-NO-${Date.now()}`;
    const now = new Date();
    const far = new Date(now);
    far.setUTCDate(far.getUTCDate() + 60);

    // computed expiry: productionDate + shelfLifeMonths
    const pOk = await prisma.product.create({
      data: {
        sku: skuOk,
        name: 'Export OK',
        productionDate: now,
        shelfLifeMonths: 2,
        expiryDate: null,
        listPrice: 10,
        salePrice: 10,
      },
    });
    const pNo = await prisma.product.create({
      data: {
        sku: skuNo,
        name: 'Export NO',
        expiryDate: far,
        productionDate: null,
        shelfLifeMonths: null,
        listPrice: 10,
        salePrice: 10,
      },
    });
    try {
      const csv = await productService.exportProductsCsv({ minDaysUntilExpiry: 10 });
      expect(csv.includes(skuOk)).toBe(true);
      // pNo is far future too, should also be included; create a near-expiry and exclude
      const nearSku = `EXP-NEAR-${Date.now()}`;
      const near = new Date(now);
      near.setUTCDate(near.getUTCDate() + 1);
      const pNear = await prisma.product.create({
        data: { sku: nearSku, name: 'Export NEAR', expiryDate: near, listPrice: 10, salePrice: 10 },
      });
      const csv2 = await productService.exportProductsCsv({ minDaysUntilExpiry: 10 });
      expect(csv2.includes(skuOk)).toBe(true);
      expect(csv2.includes(nearSku)).toBe(false);
      await prisma.product.delete({ where: { id: pNear.id } });
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: [pOk.id, pNo.id] } } });
    }
  }, 20000);

  it('searchBarcode returns matched product by exact barcode', async () => {
    if (!process.env.DATABASE_URL) return;
    const barcode = `BC-${Date.now()}`;
    const p = await prisma.product.create({
      data: { sku: `BC-SKU-${Date.now()}`, barcode, name: 'Barcode Product' },
    });
    try {
      const out = await productService.searchBarcode(barcode);
      expect(Array.isArray(out.items)).toBe(true);
      expect(out.items.some((x) => x.id === p.id)).toBe(true);
    } finally {
      await prisma.product.delete({ where: { id: p.id } });
    }
  }, 10000);

  it('searchBarcode returns multiple items when barcode duplicates exist', async () => {
    if (!process.env.DATABASE_URL) return;
    const barcode = `BC-DUP-${Date.now()}`;
    const p1 = await prisma.product.create({
      data: { sku: `BC-DUP-SKU-1-${Date.now()}`, barcode, name: 'Barcode Dup 1' },
    });
    const p2 = await prisma.product.create({
      data: { sku: `BC-DUP-SKU-2-${Date.now()}`, barcode, name: 'Barcode Dup 2' },
    });
    try {
      const out = await productService.searchBarcode(barcode, 50);
      const ids = out.items.map((x) => x.id);
      expect(ids).toContain(p1.id);
      expect(ids).toContain(p2.id);
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    }
  }, 10000);

  it('searchBarcode empty q returns empty items', async () => {
    if (!process.env.DATABASE_URL) return;
    const out = await productService.searchBarcode('   ');
    expect(out.items).toEqual([]);
  });

  it('searchBarcode respects limit', async () => {
    if (!process.env.DATABASE_URL) return;
    const barcode = `BC-LIM-${Date.now()}`;
    const ps = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        prisma.product.create({
          data: {
            sku: `BC-LIM-SKU-${i}-${Date.now()}`,
            barcode,
            name: `Barcode Lim ${i}`,
          },
        }),
      ),
    );
    try {
      const out = await productService.searchBarcode(barcode, 2);
      expect(out.items.length).toBeLessThanOrEqual(2);
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: ps.map((p) => p.id) } } });
    }
  }, 10000);

  it('listProducts returns { items, total, page, pageSize } with expiry fields', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const prodDate = new Date('2026-01-01T00:00:00Z');
    const expDate = new Date('2027-06-15T00:00:00Z');
    const p = await prisma.product.create({
      data: {
        sku: `LP-${ts}`,
        name: `List Product ${ts}`,
        productionDate: prodDate,
        shelfLifeMonths: 12,
        expiryDate: expDate,
        listPrice: 100,
        salePrice: 80,
      },
    });
    try {
      const result = await productService.listProducts(
        { sku: `LP-${ts}` },
        { page: 1, pageSize: 10 },
      );
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize', 10);
      expect(result.total).toBeGreaterThanOrEqual(1);

      const found = result.items.find((i) => i.id === p.id);
      expect(found).toBeDefined();
      expect(found!.productionDate).toBe(prodDate.toISOString());
      expect(found!.shelfLifeMonths).toBe(12);
      expect(found!.expiryDate).toBe(expDate.toISOString());
    } finally {
      await prisma.product.delete({ where: { id: p.id } });
    }
  }, 15000);

  it('listProducts with minDaysUntilExpiry filters via expiryDate path', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const now = new Date();
    const farExpiry = new Date(now);
    farExpiry.setUTCDate(farExpiry.getUTCDate() + 90);
    const nearExpiry = new Date(now);
    nearExpiry.setUTCDate(nearExpiry.getUTCDate() + 3);

    const pFar = await prisma.product.create({
      data: { sku: `MDU-FAR-${ts}`, name: 'Far Expiry', expiryDate: farExpiry, listPrice: 10, salePrice: 10 },
    });
    const pNear = await prisma.product.create({
      data: { sku: `MDU-NEAR-${ts}`, name: 'Near Expiry', expiryDate: nearExpiry, listPrice: 10, salePrice: 10 },
    });
    try {
      const result = await productService.listProducts({ minDaysUntilExpiry: 30 });
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(pFar.id);
      expect(ids).not.toContain(pNear.id);
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: [pFar.id, pNear.id] } } });
    }
  }, 15000);

  it('listProducts with minDaysUntilExpiry filters via productionDate+shelfLifeMonths path', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const now = new Date();
    const prodFar = await prisma.product.create({
      data: {
        sku: `MDU-COMP-FAR-${ts}`,
        name: 'Computed Far',
        productionDate: now,
        shelfLifeMonths: 6,
        expiryDate: null,
        listPrice: 10,
        salePrice: 10,
      },
    });
    const recentProd = new Date(now);
    recentProd.setUTCMonth(recentProd.getUTCMonth() - 1);
    const prodNear = await prisma.product.create({
      data: {
        sku: `MDU-COMP-NEAR-${ts}`,
        name: 'Computed Near',
        productionDate: recentProd,
        shelfLifeMonths: 1,
        expiryDate: null,
        listPrice: 10,
        salePrice: 10,
      },
    });
    try {
      const result = await productService.listProducts({ minDaysUntilExpiry: 30 });
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(prodFar.id);
      expect(ids).not.toContain(prodNear.id);
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: [prodFar.id, prodNear.id] } } });
    }
  }, 15000);

  it('listProducts with minDaysUntilExpiry applies filter-then-paginate correctly', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const now = new Date();
    const farExpiry = new Date(now);
    farExpiry.setUTCDate(farExpiry.getUTCDate() + 120);

    const products: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = await prisma.product.create({
        data: {
          sku: `MDU-PAGE-${ts}-${i}`,
          name: `Page Test ${i}`,
          expiryDate: farExpiry,
          listPrice: 10,
          salePrice: 10,
        },
      });
      products.push(p.id);
    }
    const nearExpiry = new Date(now);
    nearExpiry.setUTCDate(nearExpiry.getUTCDate() + 2);
    const pNear = await prisma.product.create({
      data: {
        sku: `MDU-PAGE-NEAR-${ts}`,
        name: 'Page Near',
        expiryDate: nearExpiry,
        listPrice: 10,
        salePrice: 10,
      },
    });
    products.push(pNear.id);

    try {
      const page1 = await productService.listProducts(
        { minDaysUntilExpiry: 30 },
        { page: 1, pageSize: 3 },
      );
      const page2 = await productService.listProducts(
        { minDaysUntilExpiry: 30 },
        { page: 2, pageSize: 3 },
      );
      expect(page1.pageSize).toBe(3);
      expect(page1.items.length).toBeLessThanOrEqual(3);

      const allIds = [...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)];
      expect(allIds).not.toContain(pNear.id);

      expect(page1.total).toBeGreaterThanOrEqual(5);
    } finally {
      await prisma.product.deleteMany({ where: { id: { in: products } } });
    }
  }, 20000);

  it('getProduct with includeBalances returns balances', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-BAL-${Date.now()}`, name: 'Balances Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `W-BAL-${Date.now()}`, name: 'Balances WH', merchantId: merchant.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-BAL-${Date.now()}`, name: 'Balances Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        onHandQty: 15,
      },
      update: { onHandQty: 15 },
    });

    const out = await productService.getProduct(product.id, { includeBalances: true });
    expect((out as { balances?: unknown }).balances).toBeDefined();
    const balances = (out as { balances?: { warehouseId: string; onHandQty: number }[] }).balances;
    expect(balances).toHaveLength(1);
    expect(balances![0].warehouseId).toBe(warehouse.id);
    expect(balances![0].onHandQty).toBe(15);

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);
});
