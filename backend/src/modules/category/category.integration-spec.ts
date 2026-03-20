/**
 * Integration: Category create + update (service). ADMIN_API_KEY unset → Guard passes.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { CategoryModule } from './category.module';
import { CategoryService } from './application/category.service';

describe('CategoryService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let categoryService: CategoryService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, CategoryModule],
    }).compile();
    prisma = app.get(PrismaService);
    categoryService = app.get(CategoryService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('createCategory + updateCategory', async () => {
    if (!process.env.DATABASE_URL) return;

    const code = `ct-${Date.now()}`;
    const created = await categoryService.createCategory({
      code,
      name: '測試分類',
    });
    expect(created.code).toBe(code);
    expect(created.name).toBe('測試分類');

    const updated = await categoryService.updateCategory(created.id, {
      name: '改名',
    });
    expect(updated.name).toBe('改名');

    await prisma.category.delete({ where: { id: created.id } });
  }, 10000);

  it('listCategoriesEnriched returns productCount and brandCodes', async () => {
    if (!process.env.DATABASE_URL) return;
    const rows = await categoryService.listCategoriesEnriched();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row).toHaveProperty('productCount');
    expect(row).toHaveProperty('brandCodes');
    expect(row).toHaveProperty('tags');
    expect(Array.isArray(row.brandCodes)).toBe(true);
    expect(Array.isArray(row.tags)).toBe(true);
  }, 10000);

  it('canonical code: Chinese name → derived code (x-*)', async () => {
    if (!process.env.DATABASE_URL) return;
    const created = await categoryService.createCategory({ name: '飲料' });
    expect(created.code).toMatch(/^x-[a-z0-9]+$/);
    expect(created.name).toBe('飲料');
    await prisma.category.delete({ where: { id: created.id } });
  }, 10000);

  it('canonical code: duplicate name or code → suffix -2, -3', async () => {
    if (!process.env.DATABASE_URL) return;
    const c1 = await categoryService.createCategory({ name: '零食' });
    const c2 = await categoryService.createCategory({ name: '零食' });
    const c3 = await categoryService.createCategory({ code: c1.code, name: 'SameCode' });
    expect(c1.code).toMatch(/^[a-z0-9-]+$/);
    expect(c2.code).toBe(`${c1.code}-2`);
    expect(c3.code).toBe(`${c1.code}-3`);
    await prisma.category.deleteMany({ where: { id: { in: [c1.id, c2.id, c3.id] } } });
  }, 10000);

  it('canonical code: manual code accept valid, reject invalid', async () => {
    if (!process.env.DATABASE_URL) return;
    const valid = await categoryService.createCategory({ code: 'valid-code-1', name: 'A' });
    expect(valid.code).toBe('valid-code-1');
    let errCode: string | undefined;
    try {
      await categoryService.createCategory({ code: 'Invalid Space!', name: 'B' });
    } catch (e: unknown) {
      errCode = (e as { response?: { code?: string } }).response?.code;
    }
    expect(errCode).toBe('CATEGORY_CODE_INVALID');
    await prisma.category.delete({ where: { id: valid.id } });
  }, 10000);

  it('update: omit code retains existing; send code applies rule', async () => {
    if (!process.env.DATABASE_URL) return;
    const created = await categoryService.createCategory({ code: 'orig-code', name: 'Orig' });
    const updated = await categoryService.updateCategory(created.id, { name: 'Renamed' });
    expect(updated.code).toBe('orig-code');
    expect(updated.name).toBe('Renamed');
    const updated2 = await categoryService.updateCategory(created.id, { code: 'new-code' });
    expect(updated2.code).toBe('new-code');
    await prisma.category.delete({ where: { id: created.id } });
  }, 10000);

  it('reorder updates sortOrder; validates ids', async () => {
    if (!process.env.DATABASE_URL) return;
    const c1 = await categoryService.createCategory({ code: `r1-${Date.now()}`, name: 'A' });
    const c2 = await categoryService.createCategory({ code: `r2-${Date.now()}`, name: 'B' });
    const c3 = await categoryService.createCategory({ code: `r3-${Date.now()}`, name: 'C' });
    try {
      await expect(categoryService.reorderCategories([])).rejects.toMatchObject({
        response: { code: 'CATEGORY_REORDER_EMPTY' },
      });
      await expect(categoryService.reorderCategories([c1.id, c1.id, c2.id, c3.id])).rejects.toMatchObject({
        response: { code: 'CATEGORY_REORDER_DUPLICATE_IDS' },
      });
      const all = await categoryService.listCategories();
      await expect(categoryService.reorderCategories([c1.id, c2.id])).rejects.toMatchObject({
        response: { code: 'CATEGORY_REORDER_INVALID' },
      });
      const others = all.filter((x) => ![c1.id, c2.id, c3.id].includes(x.id));
      const reorderIds = [...others.map((x) => x.id), c3.id, c1.id, c2.id];
      await categoryService.reorderCategories(reorderIds);
      const list = await categoryService.listCategories();
      const ourInList = list.filter((x) => [c1.id, c2.id, c3.id].includes(x.id));
      expect(ourInList.map((x) => x.id)).toEqual([c3.id, c1.id, c2.id]);
    } finally {
      await prisma.category.deleteMany({ where: { id: { in: [c1.id, c2.id, c3.id] } } });
    }
  }, 15000);

  it('deleteCategory removes empty category; CATEGORY_IN_USE when products reference', async () => {
    if (!process.env.DATABASE_URL) return;

    const cat = await categoryService.createCategory({
      code: `cdel-${Date.now()}`,
      name: 'To delete',
    });
    await categoryService.deleteCategory(cat.id);
    const gone = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(gone).toBeNull();

    const cat2 = await categoryService.createCategory({
      code: `cuse-${Date.now()}`,
      name: 'In use',
    });
    await prisma.product.create({
      data: {
        sku: `SKU-CAT-${Date.now()}`,
        name: 'P',
        categoryId: cat2.id,
      },
    });
    let code: string | undefined;
    try {
      await categoryService.deleteCategory(cat2.id);
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    }
    expect(code).toBe('CATEGORY_IN_USE');

    const p = await prisma.product.findFirst({ where: { categoryId: cat2.id } });
    if (p) await prisma.product.delete({ where: { id: p.id } });
    await prisma.category.delete({ where: { id: cat2.id } });
  }, 15000);
});
