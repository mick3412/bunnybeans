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

  it('listFinanceEvents filters by referenceId and paginates', async () => {
    if (!process.env.DATABASE_URL) return;

    const ref = `fin-list-${Date.now()}`;
    const a = await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: 'p1',
      currency: 'TWD',
      amount: 1,
      referenceId: ref,
    });
    const b = await financeService.recordFinanceEvent({
      type: 'SALE_PAYMENT',
      partyId: 'p1',
      currency: 'TWD',
      amount: 2,
      referenceId: ref,
    });

    const page = await financeService.listFinanceEvents({
      referenceId: ref,
      page: 1,
      pageSize: 10,
    });
    expect(page.total).toBeGreaterThanOrEqual(2);
    const ids = new Set(page.items.map((i) => i.id));
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(b.id)).toBe(true);
    expect(page.items.every((i) => i.referenceId === ref)).toBe(true);

    await prisma.financeEvent.deleteMany({ where: { referenceId: ref } });
  }, 10000);

  it('listFinanceEvents preset=last30d filters date range', async () => {
    if (!process.env.DATABASE_URL) return;
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await financeService.recordFinanceEvent({
      type: 'ADJUSTMENT',
      partyId: '',
      currency: 'TWD',
      amount: 1,
      occurredAt: old,
      referenceId: 'preset-old',
    });
    const recent = await financeService.recordFinanceEvent({
      type: 'ADJUSTMENT',
      partyId: '',
      currency: 'TWD',
      amount: 2,
      occurredAt: new Date().toISOString(),
      referenceId: 'preset-recent',
    });
    const page = await financeService.listFinanceEvents({
      preset: 'last30d',
      pageSize: 100,
    });
    const ids = page.items.map((i) => i.id);
    expect(ids).toContain(recent.id);
    expect(ids.some((id) => page.items.find((i) => i.id === id)?.referenceId === 'preset-old')).toBe(
      false,
    );
    await prisma.financeEvent.deleteMany({
      where: { referenceId: { in: ['preset-old', 'preset-recent'] } },
    });
  }, 10000);
});
