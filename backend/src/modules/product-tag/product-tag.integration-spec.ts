/**
 * Integration: ProductTag CRUD. Requires DATABASE_URL and migrated DB.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductTagModule } from './product-tag.module';
import { ProductTagService } from './application/product-tag.service';

describe('ProductTagService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let productTagService: ProductTagService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        ProductTagModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    productTagService = app.get(ProductTagService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('list returns empty when merchant has no tags; create then list returns items', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `PT-M-${Date.now()}`, name: 'ProductTag Test' },
    });
    try {
      const empty = await productTagService.list(merchant.id);
      expect(Array.isArray(empty)).toBe(true);
      expect(empty.length).toBe(0);

      const created = await productTagService.create({
        merchantId: merchant.id,
        name: '熱銷',
        code: 'HOT',
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe('熱銷');
      expect(created.code).toBe('HOT');
      expect(created.merchantId).toBe(merchant.id);

      const list = await productTagService.list(merchant.id);
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('熱銷');
      expect(list[0].code).toBe('HOT');
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('update and delete', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `PT-M2-${Date.now()}`, name: 'ProductTag Test 2' },
    });
    const created = await productTagService.create({
      merchantId: merchant.id,
      name: '新品',
      code: 'NEW',
    });
    try {
      const updated = await productTagService.update(created.id, {
        name: '新品上架',
        code: 'NEW-1',
      });
      expect(updated.name).toBe('新品上架');
      expect(updated.code).toBe('NEW-1');

      await productTagService.delete(created.id);
      const list = await productTagService.list(merchant.id);
      expect(list.length).toBe(0);
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);
});
