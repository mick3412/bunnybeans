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
      expect(created.code).toBe('hot');
      expect(created.merchantId).toBe(merchant.id);

      const list = await productTagService.list(merchant.id);
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('熱銷');
      expect(list[0].code).toBe('hot');
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('canonical code: Chinese name → derived code (x-*)', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `PT-CN-${Date.now()}`, name: 'ProductTag CN Test' },
    });
    try {
      const created = await productTagService.create({ merchantId: merchant.id, name: '飲料' });
      expect(created.code).toMatch(/^x-[a-z0-9]+$/);
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('canonical code: duplicate name or code → suffix -2, -3', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `PT-DUP-${Date.now()}`, name: 'ProductTag Dup Test' },
    });
    try {
      const t1 = await productTagService.create({ merchantId: merchant.id, name: '零食' });
      const t2 = await productTagService.create({ merchantId: merchant.id, name: '零食' });
      const t3 = await productTagService.create({ merchantId: merchant.id, code: t1.code, name: 'X' });
      expect(t2.code).toBe(`${t1.code}-2`);
      expect(t3.code).toBe(`${t1.code}-3`);
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('canonical code: manual code accept valid, reject invalid', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `PT-VAL-${Date.now()}`, name: 'ProductTag Val Test' },
    });
    try {
      const valid = await productTagService.create({
        merchantId: merchant.id,
        code: 'valid-tag-1',
        name: 'A',
      });
      expect(valid.code).toBe('valid-tag-1');
      let errCode: string | undefined;
      try {
        await productTagService.create({
          merchantId: merchant.id,
          code: 'Invalid!',
          name: 'B',
        });
      } catch (e: unknown) {
        errCode = (e as { response?: { code?: string } }).response?.code;
      }
      expect(errCode).toBe('PRODUCT_TAG_CODE_INVALID');
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('update: omit code retains existing; send code applies rule', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `PT-UPD-${Date.now()}`, name: 'ProductTag Upd Test' },
    });
    const created = await productTagService.create({
      merchantId: merchant.id,
      code: 'orig-tag',
      name: 'Orig',
    });
    try {
      const updated = await productTagService.update(created.id, { name: 'Renamed' });
      expect(updated.code).toBe('orig-tag');
      expect(updated.name).toBe('Renamed');
      const updated2 = await productTagService.update(created.id, { code: 'new-tag' });
      expect(updated2.code).toBe('new-tag');
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
      expect(updated.code).toBe('new-1');

      await productTagService.delete(created.id);
      const list = await productTagService.list(merchant.id);
      expect(list.length).toBe(0);
    } finally {
      await prisma.productTag.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);
});
