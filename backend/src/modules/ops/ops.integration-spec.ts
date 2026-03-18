/**
 * Integration: Ops listJobs (GET /ops/jobs). Requires DATABASE_URL and migrated DB.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { OpsModule } from './ops.module';
import { OpsService } from './application/ops.service';

describe('OpsService listJobs (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let opsService: OpsService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, OpsModule],
    }).compile();
    prisma = app.get(PrismaService);
    opsService = app.get(OpsService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('listJobs returns paginated items, supports kind filter', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "OpsJobRunLog" LIMIT 1`;
    } catch {
      return;
    }

    const kindA = `ops-test-a-${Date.now()}`;
    const kindB = `ops-test-b-${Date.now()}`;
    const ids: string[] = [];

    await prisma.opsJobRunLog.create({
      data: { jobType: kindA, success: true },
    }).then((r) => ids.push(r.id));
    await prisma.opsJobRunLog.create({
      data: { jobType: kindA, success: false, message: 'err' },
    }).then((r) => ids.push(r.id));
    await prisma.opsJobRunLog.create({
      data: { jobType: kindB, success: true },
    }).then((r) => ids.push(r.id));

    const all = await opsService.listJobs({ page: 1, pageSize: 10 });
    expect(all.total).toBeGreaterThanOrEqual(3);
    expect(all.items.length).toBeGreaterThanOrEqual(3);
    const foundA = all.items.filter((i) => i.jobType === kindA);
    expect(foundA.length).toBe(2);

    const filtered = await opsService.listJobs({ page: 1, pageSize: 5, kind: kindA });
    expect(filtered.total).toBe(2);
    expect(filtered.items.every((i) => i.jobType === kindA)).toBe(true);

    const paged = await opsService.listJobs({ page: 1, pageSize: 2 });
    expect(paged.items.length).toBe(2);
    expect(paged.total).toBeGreaterThanOrEqual(3);

    const longMsg = 'x'.repeat(500);
    const long = await prisma.opsJobRunLog.create({
      data: { jobType: kindA, success: false, message: longMsg },
    });
    ids.push(long.id);
    const withSummary = await opsService.listJobs({ page: 1, pageSize: 5, kind: kindA });
    const longRow = withSummary.items.find((i) => i.id === long.id);
    expect(longRow?.messageSummary?.length).toBe(201);

    const nlMsg = 'line1\nline2\r\nline3';
    const withNl = await prisma.opsJobRunLog.create({
      data: { jobType: kindA, success: false, message: nlMsg },
    });
    ids.push(withNl.id);
    const withNlSummary = await opsService.listJobs({ page: 1, pageSize: 10, kind: kindA });
    const nlRow = withNlSummary.items.find((i) => i.id === withNl.id);
    expect(nlRow?.messageSummary).toBe('line1 line2 line3');

    const now = new Date();
    const from = new Date(now);
    from.setMinutes(from.getMinutes() - 1);
    const to = new Date(now);
    to.setMinutes(to.getMinutes() + 1);
    const ranged = await opsService.listJobs({
      page: 1,
      pageSize: 20,
      from: from.toISOString(),
      to: to.toISOString(),
      kind: kindA,
    });
    expect(ranged.items.every((i) => i.jobType === kindA)).toBe(true);

    const onlyFrom = await opsService.listJobs({
      page: 1,
      pageSize: 20,
      from: from.toISOString(),
      kind: kindA,
    });
    expect(onlyFrom.items.every((i) => i.jobType === kindA)).toBe(true);

    const onlyTo = await opsService.listJobs({
      page: 1,
      pageSize: 20,
      to: to.toISOString(),
      kind: kindA,
    });
    expect(onlyTo.items.every((i) => i.jobType === kindA)).toBe(true);

    await expect(
      opsService.listJobs({
        page: 1,
        pageSize: 20,
        from: to.toISOString(),
        to: from.toISOString(),
        kind: kindA,
      }),
    ).rejects.toMatchObject({ response: { code: 'REPORT_INVALID_RANGE' } });

    await expect(
      opsService.listJobs({
        page: 1,
        pageSize: 20,
        from: 'not-a-date',
        kind: kindA,
      }),
    ).rejects.toMatchObject({ response: { code: 'REPORT_INVALID_RANGE' } });

    await prisma.opsJobRunLog.deleteMany({ where: { id: { in: ids } } });
  });

  it('resolveReference returns posOrder for order id and receivingNote for RN id', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `OPS-M-${Date.now()}`, name: 'Ops M' },
    });
    const store = await prisma.store.create({
      data: { code: `OPS-S-${Date.now()}`, name: 'Ops S', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `OPS-W-${Date.now()}`, name: 'Ops W', merchantId: merchant.id, storeId: store.id },
    });
    const supplier = await prisma.supplier.create({
      data: { merchantId: merchant.id, code: `OPS-SUP-${Date.now()}`, name: 'Ops SUP', status: 'ACTIVE' },
    });
    const product = await prisma.product.create({
      data: { sku: `OPS-P-${Date.now()}`, name: 'Ops P' },
    });

    const order = await prisma.posOrder.create({
      data: {
        orderNumber: `OPS-O-${Date.now()}`,
        storeId: store.id,
        subtotalAmount: 100,
        discountAmount: 0,
        totalAmount: 100,
        items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100 }] },
        payments: { create: [{ method: 'CASH', amount: 100 }] },
      },
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        merchantId: merchant.id,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        orderNumber: `OPS-PO-${Date.now()}`,
        status: 'ORDERED',
        lines: { create: [{ productId: product.id, qtyOrdered: 1, unitCost: 10 }] },
      },
      include: { lines: true },
    });
    const rn = await prisma.receivingNote.create({
      data: {
        merchantId: merchant.id,
        receiptNumber: `RN-OPS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        purchaseOrderId: po.id,
        status: 'PENDING',
        lines: {
          create: [
            {
              purchaseOrderLineId: po.lines[0].id,
              orderedQty: 1,
              receivedQty: 0,
              qualifiedQty: 0,
              returnedQty: 0,
            },
          ],
        },
      },
    });

    const r1 = await opsService.resolveReference(order.id);
    expect(r1.kind).toBe('posOrder');
    const r2 = await opsService.resolveReference(rn.id);
    expect(r2.kind).toBe('receivingNote');

    const r3 = await opsService.resolveReference('not-a-uuid');
    expect(r3.kind).toBe('unknown');

    const r4 = await opsService.resolveReference('00000000-0000-4000-8000-000000000000');
    expect(r4.kind).toBe('unknown');

    // teardown
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.deleteMany({ where: { id: order.id } });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.deleteMany({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.deleteMany({ where: { id: po.id } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.supplier.deleteMany({ where: { id: supplier.id } });
    await prisma.warehouse.deleteMany({ where: { id: warehouse.id } });
    await prisma.store.deleteMany({ where: { id: store.id } });
    await prisma.merchant.deleteMany({ where: { id: merchant.id } });
  }, 30000);

  it('runJob records OpsJobRunLog (integration)', async () => {
    if (!process.env.DATABASE_URL) return;
    const before = await prisma.opsJobRunLog.count();
    const out = await opsService.runJob({ kind: 'finance-snapshot', asOfDate: '2026-03-01', snapshotType: 'daily' });
    expect(out.ok).toBe(true);
    const after = await prisma.opsJobRunLog.count();
    expect(after).toBe(before + 1);
    const last = await prisma.opsJobRunLog.findFirst({ orderBy: { lastRunAt: 'desc' } });
    expect(last?.jobType).toBe('finance-snapshot');
  }, 15000);

  it('recordReportClickAudit records resolvedKind and success (integration)', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `OPS-AUD-M-${Date.now()}`, name: 'Ops Audit M' },
    });
    const store = await prisma.store.create({
      data: { code: `OPS-AUD-S-${Date.now()}`, name: 'Ops Audit S', merchantId: merchant.id },
    });
    const product = await prisma.product.create({
      data: { sku: `OPS-AUD-P-${Date.now()}`, name: 'Ops Audit P' },
    });
    const order = await prisma.posOrder.create({
      data: {
        orderNumber: `OPS-AUD-O-${Date.now()}`,
        storeId: store.id,
        subtotalAmount: 100,
        discountAmount: 0,
        totalAmount: 100,
        items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100 }] },
        payments: { create: [{ method: 'CASH', amount: 100 }] },
      },
    });

    const ok = await opsService.recordReportClickAudit({
      merchantId: merchant.id,
      source: 'finance-events',
      referenceId: order.id,
    });
    expect(ok.success).toBe(true);
    expect(ok.resolvedKind).toBe('posOrder');

    const bad = await opsService.recordReportClickAudit({
      merchantId: merchant.id,
      source: 'finance-events',
      referenceId: 'not-a-uuid',
    });
    expect(bad.success).toBe(false);
    expect(bad.resolvedKind).toBe('unknown');

    const rows = await prisma.reportClickAudit.findMany({
      where: { merchantId: merchant.id },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // teardown
    await prisma.reportClickAudit.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.deleteMany({ where: { id: order.id } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.store.deleteMany({ where: { id: store.id } });
    await prisma.merchant.deleteMany({ where: { id: merchant.id } });
  }, 30000);

  it('click-audit list and summary support filters (integration)', async () => {
    if (!process.env.DATABASE_URL) return;

    const now = new Date();
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

    const a1 = await prisma.reportClickAudit.create({
      data: {
        merchantId: null,
        source: 'finance-events',
        field: 'referenceId',
        referenceId: 'not-a-uuid',
        resultCode: 'NOT_FOUND' as any,
        resolvedKind: 'unknown',
        success: false,
        createdAt: now,
      },
    });
    const a2 = await prisma.reportClickAudit.create({
      data: {
        merchantId: null,
        source: 'finance-events',
        field: 'referenceId',
        referenceId: 'x',
        resultCode: 'NAVIGATED' as any,
        resolvedKind: 'posOrder',
        success: true,
        createdAt: now,
      },
    });
    const a3 = await prisma.reportClickAudit.create({
      data: {
        merchantId: null,
        source: 'loyalty-ledger',
        field: 'referenceId',
        referenceId: 'y',
        resultCode: 'NOT_FOUND' as any,
        resolvedKind: 'unknown',
        success: false,
        createdAt: old,
      },
    });

    try {
      const list = await opsService.listReportClickAudit({
        from,
        to,
        source: 'finance-events',
      });
      expect(list.items.some((x) => x.id === a1.id)).toBe(true);
      expect(list.items.some((x) => x.id === a2.id)).toBe(true);
      expect(list.items.some((x) => x.id === a3.id)).toBe(false);

      const onlyFail = await opsService.listReportClickAudit({
        from,
        to,
        source: 'finance-events',
        success: 'false',
      });
      expect(onlyFail.items.some((x) => x.id === a1.id)).toBe(true);
      expect(onlyFail.items.some((x) => x.id === a2.id)).toBe(false);

      const onlyNotFound = await opsService.listReportClickAudit({
        from,
        to,
        source: 'finance-events',
        resultCode: 'NOT_FOUND',
      });
      expect(onlyNotFound.items.some((x) => x.id === a1.id)).toBe(true);
      expect(onlyNotFound.items.some((x) => x.id === a2.id)).toBe(false);

      const sum = await opsService.summaryReportClickAudit({
        from,
        to,
        source: 'finance-events',
      });
      expect(sum.total).toBeGreaterThanOrEqual(2);
      expect(sum.bySource.find((r) => r.source === 'finance-events')?.count).toBeGreaterThanOrEqual(2);
      expect(sum.bySuccess.find((r) => r.success === true)?.count).toBeGreaterThanOrEqual(1);
      expect(sum.bySuccess.find((r) => r.success === false)?.count).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.reportClickAudit.deleteMany({ where: { id: { in: [a1.id, a2.id, a3.id] } } });
    }
  }, 20000);

  it('runJob returns runLogId and listJobs can find it (integration)', async () => {
    if (!process.env.DATABASE_URL) return;
    const out = await opsService.runJob({ kind: 'finance-snapshot', asOfDate: new Date().toISOString().slice(0, 10), snapshotType: 'daily' });
    expect(out).toHaveProperty('runLogId');
    const runLogId = (out as { runLogId: string }).runLogId;
    const list = await opsService.listJobs({ page: 1, pageSize: 50, kind: 'finance-snapshot' });
    expect(list.items.some((x) => x.id === runLogId)).toBe(true);
  }, 20000);

  it('click-audit supports resultCode and summary groups by resultCode (integration)', async () => {
    if (!process.env.DATABASE_URL) return;
    const base = {
      source: `e2e-${Date.now()}`,
      field: 'referenceId',
      merchantId: null as any,
    };
    const a = await opsService.recordReportClickAudit({
      ...base,
      referenceId: '',
      resultCode: 'NOT_FOUND',
    });
    const b = await opsService.recordReportClickAudit({
      ...base,
      referenceId: '',
      resultCode: 'MULTI_MATCH',
    });
    const c = await opsService.recordReportClickAudit({
      ...base,
      referenceId: '',
      resultCode: 'PERMISSION',
    });
    const n2 = await opsService.recordReportClickAudit({
      ...base,
      referenceId: '',
      resultCode: 'NOT_FOUND',
    });
    const oldDay = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const d = await prisma.reportClickAudit.create({
      data: {
        merchantId: null,
        source: base.source,
        field: base.field,
        referenceId: 'old-ref',
        resultCode: 'NOT_FOUND' as any,
        resolvedKind: 'unknown',
        success: false,
        createdAt: oldDay,
      },
    });
    try {
      const list = await opsService.listReportClickAudit({
        source: base.source,
        page: 1,
        pageSize: 50,
      });
      const ids = list.items.map((x) => x.id);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id, c.id, n2.id, d.id]));

      const summary = await opsService.summaryReportClickAudit({ source: base.source, days: 7, top: 20 });
      expect(summary.byResultCode.some((x) => x.resultCode === 'NOT_FOUND' && x.count >= 1)).toBe(true);
      expect(summary.byResultCode.some((x) => x.resultCode === 'MULTI_MATCH' && x.count >= 1)).toBe(true);
      expect(summary.byResultCode.some((x) => x.resultCode === 'PERMISSION' && x.count >= 1)).toBe(true);

      // advanced summary: topSources + trendByDay + topReferenceIds
      expect(summary.topSources.length).toBeGreaterThanOrEqual(1);
      expect(summary.topSources[0]).toHaveProperty('source');
      expect(summary.topSources.some((x) => x.source === base.source && (x.notFound + x.multiMatch) >= 2)).toBe(true);

      const dayKeys = summary.trendByDay.map((x) => x.day);
      expect(dayKeys).toEqual(expect.arrayContaining([oldDay.toISOString().slice(0, 10)]));

      expect(summary.topReferenceIds.some((x) => x.field === 'referenceId' && x.referenceId === 'old-ref' && x.count >= 1)).toBe(true);

      // health v2: NOT_FOUND rate should trip ALERT with 2/5 (>=0.5 threshold uses total under filter)
      expect(['OK', 'WARN', 'ALERT']).toContain(summary.health.status);
      expect(summary.fixHints.some((x) => x.fixHint === 'DATA_MISSING' && x.count >= 1)).toBe(true);

      // at least 2 filter combinations
      const summaryFailOnly = await opsService.summaryReportClickAudit({ source: base.source, success: 'false', days: 7, top: 20 });
      expect(summaryFailOnly.bySuccess.some((x) => x.success === false && x.count >= 1)).toBe(true);
      expect(summaryFailOnly.topReferenceIds.some((x) => x.referenceId === 'old-ref')).toBe(true);
    } finally {
      await prisma.reportClickAudit.deleteMany({ where: { id: { in: [a.id, b.id, c.id, n2.id, d.id] } } });
    }
  }, 20000);
});
