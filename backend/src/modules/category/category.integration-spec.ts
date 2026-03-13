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
});
