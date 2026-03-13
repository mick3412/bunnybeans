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

    const code = `CT-${Date.now()}`;
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

  it('deleteCategory removes empty category; CATEGORY_IN_USE when products reference', async () => {
    if (!process.env.DATABASE_URL) return;

    const cat = await categoryService.createCategory({
      code: `CDEL-${Date.now()}`,
      name: 'To delete',
    });
    await categoryService.deleteCategory(cat.id);
    const gone = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(gone).toBeNull();

    const cat2 = await categoryService.createCategory({
      code: `CUSE-${Date.now()}`,
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
