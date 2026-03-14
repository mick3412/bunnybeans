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
});
