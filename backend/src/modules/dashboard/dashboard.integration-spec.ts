import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../shared/database/database.module';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './application/dashboard.service';

describe('DashboardService (integration)', () => {
  let app: TestingModule;
  let svc: DashboardService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, DashboardModule],
    }).compile();
    svc = app.get(DashboardService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('getSummary returns numeric fields', async () => {
    if (!process.env.DATABASE_URL) return;
    const s = await svc.getSummary();
    expect(typeof s.productCount).toBe('number');
    expect(typeof s.skuOutOfStockCount).toBe('number');
    expect(typeof s.skuLowStockCount).toBe('number');
    expect(typeof s.ordersTodayCount).toBe('number');
    expect(typeof s.totalOnHandUnits).toBe('number');
    expect(typeof s.inventoryValueApprox).toBe('string');
    expect(s.lowStockThreshold).toBeGreaterThan(0);
  });
});
