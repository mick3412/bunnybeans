import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductModule } from '../product/product.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ImportsModule } from './imports.module';
import { ImportsService } from './application/imports.service';

describe('ImportsService async job (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let svc: ImportsService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        ProductModule,
        InventoryModule,
        ImportsModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    svc = app.get(ImportsService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('products_csv job completes with ok', async () => {
    if (!process.env.DATABASE_URL) return;
    const sku = `JOB-${Date.now()}`;
    const csv = `sku,name,salePrice\n${sku},Job Product,1\n`;
    const { jobId } = await svc.createJob('products_csv', Buffer.from(csv));
    for (let i = 0; i < 50; i++) {
      const j = await svc.getJob(jobId);
      if (j.status === 'done') {
        expect(j.result).toMatchObject({ ok: 1, failed: [] });
        await prisma.product.deleteMany({ where: { sku } });
        await prisma.bulkImportJob.delete({ where: { id: jobId } }).catch(() => {});
        return;
      }
      if (j.status === 'failed') throw new Error(j.error ?? 'job failed');
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('job timeout');
  }, 20000);
});
