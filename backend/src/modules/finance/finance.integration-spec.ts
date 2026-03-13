/**
 * Integration test: Finance record event → event persisted; verify via Prisma.
 * Requires DATABASE_URL and a migrated database (e.g. pnpm prisma:db:push).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { FinanceModule } from './finance.module';
import { FinanceService } from './application/finance.service';

describe('FinanceService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let financeService: FinanceService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping Finance integration test');
      return;
    }
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        FinanceModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    financeService = app.get(FinanceService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('records SALE_RECEIVABLE event and persists to database', async () => {
    if (!process.env.DATABASE_URL) return;

    const refId = `finance-test-${Date.now()}`;
    const result = await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: null,
      currency: 'TWD',
      amount: 500,
      occurredAt: new Date().toISOString(),
      referenceId: refId,
      note: 'Integration test',
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.type).toBe('SALE_RECEIVABLE');
    expect(result.referenceId).toBe(refId);
    expect(Number(result.amount)).toBe(500);

    const fromDb = await prisma.financeEvent.findUnique({
      where: { id: result.id },
    });
    expect(fromDb).toBeDefined();
    expect(fromDb?.type).toBe('SALE_RECEIVABLE');
    expect(fromDb?.referenceId).toBe(refId);
    expect(Number(fromDb?.amount)).toBe(500);

    await prisma.financeEvent.delete({ where: { id: result.id } });
  }, 10000);
});
