/**
 * Integration: Brand CRUD + reorder. Requires DATABASE_URL and migrated DB.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { BrandModule } from './brand.module';
import { BrandService } from './application/brand.service';

describe('BrandService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let brandService: BrandService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, BrandModule],
    }).compile();
    prisma = app.get(PrismaService);
    brandService = app.get(BrandService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('reorder updates sortOrder; validates ids', async () => {
    if (!process.env.DATABASE_URL) return;
    const b1 = await brandService.createBrand({ code: `br1-${Date.now()}`, name: 'B1' });
    const b2 = await brandService.createBrand({ code: `br2-${Date.now()}`, name: 'B2' });
    const b3 = await brandService.createBrand({ code: `br3-${Date.now()}`, name: 'B3' });
    try {
      await expect(brandService.reorderBrands([])).rejects.toMatchObject({
        response: { code: 'BRAND_REORDER_EMPTY' },
      });
      await expect(brandService.reorderBrands([b1.id, b1.id, b2.id, b3.id])).rejects.toMatchObject({
        response: { code: 'BRAND_REORDER_DUPLICATE_IDS' },
      });
      const all = await brandService.listBrands();
      await expect(brandService.reorderBrands([b1.id, b2.id])).rejects.toMatchObject({
        response: { code: 'BRAND_REORDER_INVALID' },
      });
      const others = all.filter((x) => ![b1.id, b2.id, b3.id].includes(x.id));
      const reorderIds = [...others.map((x) => x.id), b3.id, b1.id, b2.id];
      await brandService.reorderBrands(reorderIds);
      const list = await brandService.listBrands();
      const ourInList = list.filter((x) => [b1.id, b2.id, b3.id].includes(x.id));
      expect(ourInList.map((x) => x.id)).toEqual([b3.id, b1.id, b2.id]);
    } finally {
      await prisma.brand.deleteMany({ where: { id: { in: [b1.id, b2.id, b3.id] } } });
    }
  }, 15000);
});
