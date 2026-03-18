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

  it('searchBarcode empty q returns empty items', async () => {
    if (!process.env.DATABASE_URL) return;
    const out = await productService.searchBarcode('   ');
    expect(out.items).toEqual([]);
  });

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
