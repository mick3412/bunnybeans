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
    expect(result.referenceKind).toBe('posOrder');
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
    expect(page.items.every((i) => i.referenceKind === 'posOrder')).toBe(true);

    await prisma.financeEvent.deleteMany({ where: { referenceId: ref } });
  }, 10000);

  it('exportFinanceEventsCsv includes rows for referenceId filter', async () => {
    if (!process.env.DATABASE_URL) return;

    const ref = `fin-csv-${Date.now()}`;
    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: 'party-csv',
      currency: 'TWD',
      amount: 99,
      referenceId: ref,
      note: 'csv row',
    });
    const csv = await financeService.exportFinanceEventsCsv({ referenceId: ref });
    expect(csv).toContain('id,type,partyId,currency,amount,taxAmount,occurredAt,referenceId,note,createdAt');
    expect(csv).toContain(ref);
    expect(csv).toContain('SALE_RECEIVABLE');
    expect(csv).toContain('99');

    await prisma.financeEvent.deleteMany({ where: { referenceId: ref } });
  }, 10000);

  it('listFinanceEvents filters by type', async () => {
    if (!process.env.DATABASE_URL) return;

    const ref = `fin-type-${Date.now()}`;
    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: null,
      currency: 'TWD',
      amount: 10,
      referenceId: ref,
    });
    await financeService.recordFinanceEvent({
      type: 'ADJUSTMENT',
      partyId: null,
      currency: 'TWD',
      amount: 20,
      referenceId: ref,
    });

    const page = await financeService.listFinanceEvents({
      referenceId: ref,
      type: 'SALE_RECEIVABLE',
      page: 1,
      pageSize: 10,
    });
    expect(page.items.length).toBe(1);
    expect(page.items[0].type).toBe('SALE_RECEIVABLE');
    expect(page.total).toBe(1);

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

  it('getSummary groupBy=type returns byType sums', async () => {
    if (!process.env.DATABASE_URL) return;

    const summary = await financeService.getSummary({
      preset: 'last30d',
      groupBy: 'type',
    });
    expect(summary).toHaveProperty('byType');
    const byType = (summary as { byType: Record<string, number> }).byType;
    expect(typeof byType).toBe('object');
    for (const v of Object.values(byType)) {
      expect(typeof v).toBe('number');
    }
  }, 10000);

  it('getSummary groupBy=partyId returns byParty array', async () => {
    if (!process.env.DATABASE_URL) return;

    const summary = await financeService.getSummary({
      preset: 'last30d',
      groupBy: 'partyId',
    });
    expect(summary).toHaveProperty('byParty');
    const byParty = (summary as { byParty: { partyId: string; amountsByType: Record<string, number> }[] })
      .byParty;
    expect(Array.isArray(byParty)).toBe(true);
    for (const row of byParty) {
      expect(row).toHaveProperty('partyId');
      expect(typeof row.amountsByType).toBe('object');
      expect(row).toHaveProperty('displayName');
      expect(row).toHaveProperty('kind');
      for (const v of Object.values(row.amountsByType)) {
        expect(typeof v).toBe('number');
      }
    }
  }, 10000);

  it('getSummary groupBy=day returns trend buckets', async () => {
    if (!process.env.DATABASE_URL) return;
    const pid = `trend-${Date.now()}`;
    const d1 = new Date('2024-03-01T10:00:00.000Z').toISOString();
    const d2 = new Date('2024-03-02T10:00:00.000Z').toISOString();
    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: pid,
      currency: 'TWD',
      amount: 10,
      occurredAt: d1,
    });
    await financeService.recordFinanceEvent({
      type: 'SALE_PAYMENT',
      partyId: pid,
      currency: 'TWD',
      amount: 3,
      occurredAt: d1,
    });
    await financeService.recordFinanceEvent({
      type: 'ADJUSTMENT',
      partyId: pid,
      currency: 'TWD',
      amount: 2,
      occurredAt: d2,
    });
    try {
      const out = await financeService.getSummary({
        from: '2024-03-01T00:00:00.000Z',
        to: '2024-03-03T00:00:00.000Z',
        groupBy: 'day',
      });
      expect(out).toHaveProperty('bucket', 'day');
      const items = (out as { items: Array<{ periodStart: string; amountsByType: Record<string, number> }> }).items;
      expect(items.length).toBeGreaterThanOrEqual(2);
      const day1 = items.find((x) => x.periodStart.startsWith('2024-03-01'));
      const day2 = items.find((x) => x.periodStart.startsWith('2024-03-02'));
      expect(day1?.amountsByType.SALE_RECEIVABLE).toBe(10);
      expect(day1?.amountsByType.SALE_PAYMENT).toBe(3);
      expect(day2?.amountsByType.ADJUSTMENT).toBe(2);
    } finally {
      await prisma.financeEvent.deleteMany({ where: { partyId: pid } });
    }
  }, 10000);

  it('getBalances returns items with receivable and payable (Phase 4) and supports partyId filter', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-BAL-BASIC-${Date.now()}`, name: 'Balances Basic Merchant' },
    });
    const cust = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'BalBasicCustomer', phone: `bal-basic-${Date.now()}` },
    });
    const sup = await prisma.supplier.create({
      data: { merchantId: merchant.id, code: `BAL-BASIC-SUP-${Date.now()}`, name: 'BalBasicSupplier', status: 'ACTIVE' },
    });
    const party1 = `customer:${cust.id}`;
    const party2 = `supplier:${sup.id}`;

    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: party1,
      currency: 'TWD',
      amount: 100,
    });
    await financeService.recordFinanceEvent({
      type: 'SALE_PAYMENT',
      partyId: party1,
      currency: 'TWD',
      amount: 40,
    });
    await financeService.recordFinanceEvent({
      type: 'PURCHASE_PAYABLE',
      partyId: party1,
      currency: 'TWD',
      amount: 10,
    });

    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: party2,
      currency: 'TWD',
      amount: 50,
    });

    const all = await financeService.getBalances({ merchantId: merchant.id });
    expect(all).toHaveProperty('items');
    expect(Array.isArray(all.items)).toBe(true);
    expect(all).toHaveProperty('page');
    expect(all).toHaveProperty('pageSize');
    expect(all).toHaveProperty('total');
    expect(all).toHaveProperty('totals');

    const row1 = all.items.find((r) => r.partyId === party1);
    const row2 = all.items.find((r) => r.partyId === party2);
    expect(row1).toBeDefined();
    expect(row2).toBeDefined();
    expect(row1?.receivable).toBe(60);
    expect(row1?.payable).toBe(10);
    expect(row2?.receivable).toBe(50);
    expect(row2?.payable).toBe(0);

    const onlyParty1 = await financeService.getBalances({ merchantId: merchant.id, partyId: party1 });
    expect(Array.isArray(onlyParty1.items)).toBe(true);
    expect(onlyParty1.items.length).toBe(1);
    expect(onlyParty1.items[0].partyId).toBe(party1);
    expect(onlyParty1.items[0].receivable).toBe(60);
    expect(onlyParty1.items[0].payable).toBe(10);

    await prisma.financeEvent.deleteMany({
      where: { partyId: { in: [party1, party2] } },
    });
    await prisma.customer.delete({ where: { id: cust.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 10000);

  it('getBalances supports pagination and totals are for filtered set', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-BAL-PAGE-${Date.now()}`, name: 'Balances Page Merchant' },
    });
    const customers = [];
    for (let i = 0; i < 6; i++) {
      customers.push(
        await prisma.customer.create({
          data: { merchantId: merchant.id, name: `BalPageCustomer-${i}`, phone: `bal-page-${Date.now()}-${i}` },
        }),
      );
    }
    const parties = customers.map((c) => `customer:${c.id}`);
    for (const pid of parties) {
      await financeService.recordFinanceEvent({
        type: 'SALE_RECEIVABLE',
        partyId: pid,
        currency: 'TWD',
        amount: 10,
      });
    }
    try {
      const page1 = await financeService.getBalances({ merchantId: merchant.id, page: 1, pageSize: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.total).toBeGreaterThanOrEqual(6);
      expect(page1.totals.receivable).toBeGreaterThanOrEqual(60);

      const page2 = await financeService.getBalances({ merchantId: merchant.id, page: 2, pageSize: 2 });
      expect(page2.items.length).toBe(2);
      expect(page2.page).toBe(2);
      expect(page2.pageSize).toBe(2);
      expect(page2.total).toBe(page1.total);
      expect(page2.totals.receivable).toBe(page1.totals.receivable);
    } finally {
      await prisma.financeEvent.deleteMany({ where: { partyId: { in: parties } } });
      await prisma.customer.deleteMany({ where: { id: { in: customers.map((c) => c.id) } } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('getBalances returns displayName and kind; kind filter works', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `M-BAL-${Date.now()}`, name: 'Balances Merchant' },
    });
    const cust = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: 'BalTestCustomer',
        phone: `bal-${Date.now()}`,
      },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: merchant.id,
        code: `BAL-SUP-${Date.now()}`,
        name: 'BalTestSupplier',
        status: 'ACTIVE',
      },
    });
    const custPid = `customer:${cust.id}`;
    const supPid = `supplier:${sup.id}`;
    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: custPid,
      currency: 'TWD',
      amount: 100,
    });
    await financeService.recordFinanceEvent({
      type: 'PURCHASE_PAYABLE',
      partyId: supPid,
      currency: 'TWD',
      amount: 50,
    });
    const all = await financeService.getBalances({ merchantId: merchant.id });
    const custRow = all.items.find((r) => r.partyId === custPid);
    const supRow = all.items.find((r) => r.partyId === supPid);
    expect(custRow).toBeDefined();
    expect(custRow?.displayName).toBe('BalTestCustomer');
    expect(custRow?.kind).toBe('customer');
    expect(supRow).toBeDefined();
    expect(supRow?.displayName).toBe('BalTestSupplier');
    expect(supRow?.kind).toBe('supplier');
    const onlyCust = await financeService.getBalances({ merchantId: merchant.id, kind: 'customer' });
    expect(onlyCust.items.every((r) => r.kind === 'customer')).toBe(true);
    const onlySup = await financeService.getBalances({ merchantId: merchant.id, kind: 'supplier' });
    expect(onlySup.items.every((r) => r.kind === 'supplier')).toBe(true);
    await prisma.financeEvent.deleteMany({
      where: { partyId: { in: [custPid, supPid] } },
    });
    await prisma.customer.delete({ where: { id: cust.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 10000);

  it('getBalances: prefixed partyId resolves via Party view; unknown partyId has no kind/displayName', async () => {
    if (!process.env.DATABASE_URL) return;
    const merchant = await prisma.merchant.create({
      data: { code: `M-PARTY-${Date.now()}`, name: 'Party Merchant' },
    });
    const cust = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'PartyCustomer', phone: `party-${Date.now()}` },
    });
    const pid = `customer:${cust.id}`;
    const unknownPid = `platform:shopee`;
    await financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId: pid,
      currency: 'TWD',
      amount: 10,
    });
    await financeService.recordFinanceEvent({
      type: 'ADJUSTMENT',
      partyId: unknownPid,
      currency: 'TWD',
      amount: 1,
    });
    try {
      const all = await financeService.getBalances({ merchantId: merchant.id });
      const row = all.items.find((r) => r.partyId === pid);
      expect(row?.kind).toBe('customer');
      expect(row?.displayName).toBe('PartyCustomer');
      const unk = all.items.find((r) => r.partyId === unknownPid);
      expect(unk).toBeUndefined();
    } finally {
      await prisma.financeEvent.deleteMany({ where: { partyId: { in: [pid, unknownPid] } } });
      await prisma.customer.delete({ where: { id: cust.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
  }, 10000);

  it('getBalances is isolated by merchantId (Party view)', async () => {
    if (!process.env.DATABASE_URL) return;
    const ma = await prisma.merchant.create({ data: { code: `M-ISO-A-${Date.now()}`, name: 'Iso A' } });
    const mb = await prisma.merchant.create({ data: { code: `M-ISO-B-${Date.now()}`, name: 'Iso B' } });
    const ca = await prisma.customer.create({ data: { merchantId: ma.id, name: 'IsoCustA', phone: `iso-a-${Date.now()}` } });
    const cb = await prisma.customer.create({ data: { merchantId: mb.id, name: 'IsoCustB', phone: `iso-b-${Date.now()}` } });
    const pa = `customer:${ca.id}`;
    const pb = `customer:${cb.id}`;
    await financeService.recordFinanceEvent({ type: 'SALE_RECEIVABLE', partyId: pa, currency: 'TWD', amount: 11 });
    await financeService.recordFinanceEvent({ type: 'SALE_RECEIVABLE', partyId: pb, currency: 'TWD', amount: 22 });
    try {
      const a = await financeService.getBalances({ merchantId: ma.id });
      expect(a.items.some((r) => r.partyId === pa)).toBe(true);
      expect(a.items.some((r) => r.partyId === pb)).toBe(false);

      const b = await financeService.getBalances({ merchantId: mb.id });
      expect(b.items.some((r) => r.partyId === pb)).toBe(true);
      expect(b.items.some((r) => r.partyId === pa)).toBe(false);

      const cross = await financeService.getBalances({ merchantId: ma.id, partyId: pb });
      expect(cross.items.length).toBe(0);
    } finally {
      await prisma.financeEvent.deleteMany({ where: { partyId: { in: [pa, pb] } } });
      await prisma.customer.deleteMany({ where: { id: { in: [ca.id, cb.id] } } });
      await prisma.merchant.deleteMany({ where: { id: { in: [ma.id, mb.id] } } });
    }
  }, 15000);

  it('closePeriod blocks recordFinanceEvent (global close) and unlock allows write again', async () => {
    if (!process.env.DATABASE_URL) return;

    // Use a stable past date to avoid impacting other suites running in parallel.
    const today = new Date('2000-01-15T12:00:00.000Z');
    const startDate = today.toISOString().slice(0, 10);
    const endDate = startDate;
    const closed = await financeService.closePeriod({ startDate, endDate });
    try {
      let code: string | undefined;
      try {
        await financeService.recordFinanceEvent({
          type: 'ADJUSTMENT',
          partyId: null,
          currency: 'TWD',
          amount: 1,
          occurredAt: today.toISOString(),
          note: 'should be blocked',
        });
      } catch (e: unknown) {
        const r = e as { response?: { code?: string } };
        code = r.response?.code;
      }
      expect(code).toBe('FINANCE_PERIOD_CLOSED');

      await financeService.unlockPeriod(closed.id);
      const ok = await financeService.recordFinanceEvent({
        type: 'ADJUSTMENT',
        partyId: null,
        currency: 'TWD',
        amount: 2,
        occurredAt: today.toISOString(),
        note: 'should pass after unlock',
      });
      expect(ok).toBeDefined();
      await prisma.financeEvent.delete({ where: { id: ok.id } });
    } finally {
      await prisma.financePeriodClose.deleteMany({ where: { id: closed.id } });
    }
  }, 15000);

  it('recordFinanceEvent writes FinanceAuditLog and listAuditLog can query by eventId', async () => {
    if (!process.env.DATABASE_URL) return;
    const out = await financeService.recordFinanceEvent(
      {
        type: 'ADJUSTMENT',
        partyId: null,
        currency: 'TWD',
        amount: 9,
        occurredAt: new Date().toISOString(),
        note: 'audit test',
      },
      { actor: 'tester', source: 'integration' },
    );
    try {
      const log = await financeService.listAuditLog({ eventId: out.id, page: 1, pageSize: 10 });
      expect(log.total).toBeGreaterThanOrEqual(1);
      const row = log.items.find((x) => x.eventId === out.id);
      expect(row).toBeDefined();
      expect(row?.actor).toBe('tester');
      expect(row?.source).toBe('integration');
    } finally {
      await prisma.financeAuditLog.deleteMany({ where: { eventId: out.id } });
      await prisma.financeEvent.delete({ where: { id: out.id } });
    }
  }, 15000);

  it('createSnapshot persists and listSnapshots returns items', async () => {
    if (!process.env.DATABASE_URL) return;
    const asOfDate = new Date().toISOString().slice(0, 10);
    const created = await financeService.createSnapshot({ asOfDate, type: 'daily' });
    try {
      const list = await financeService.listSnapshots({ type: 'daily', page: 1, pageSize: 20 });
      expect(list.items.some((x) => x.id === created.id)).toBe(true);
    } finally {
      await prisma.financeSnapshot.deleteMany({ where: { id: created.id } });
    }
  }, 20000);

  it('getSnapshotById returns summary and generatedAt', async () => {
    if (!process.env.DATABASE_URL) return;
    const asOfDate = new Date().toISOString().slice(0, 10);
    const created = await financeService.createSnapshot({ asOfDate, type: 'daily' });
    try {
      const got = await financeService.getSnapshotById(created.id);
      expect(got.id).toBe(created.id);
      expect(got.asOfDate).toBe(asOfDate);
      expect(got.type).toBe('daily');
      expect(got.path).toContain(asOfDate);
      expect(typeof got.generatedAt).toBe('string');
      expect(got.summary).toBeDefined();
      expect((got.summary as any).asOfDate).toBe(asOfDate);
    } finally {
      await prisma.financeSnapshot.deleteMany({ where: { id: created.id } });
    }
  }, 20000);

  it('createSnapshot returns fields consistent with getSnapshotById', async () => {
    if (!process.env.DATABASE_URL) return;
    const asOfDate = new Date().toISOString().slice(0, 10);
    const created = await financeService.createSnapshot({ asOfDate, type: 'daily' });
    try {
      expect(created.id).toBeTruthy();
      expect(created.asOfDate).toBe(asOfDate);
      expect(created.type).toBe('daily');
      expect(typeof created.generatedAt).toBe('string');
      expect(created.summary).toBeDefined();
      expect(created.path).toContain(asOfDate);

      const got = await financeService.getSnapshotById(created.id);
      expect(got.id).toBe(created.id);
      expect(got.asOfDate).toBe(created.asOfDate);
      expect(got.type).toBe(created.type);
      expect(got.path).toBe(created.path);
      expect(got.generatedAt).toBe(created.generatedAt);
    } finally {
      await prisma.financeSnapshot.deleteMany({ where: { id: created.id } });
    }
  }, 20000);
});
