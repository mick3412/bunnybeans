import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { CustomerModule } from './customer.module';
import { CustomerService } from './application/customer.service';

describe('CustomerService import (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let svc: CustomerService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        CustomerModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    svc = app.get(CustomerService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates row and fails duplicate phone', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}`, name: 'CM' },
    });
    const csv = [
      'name,phone,memberLevel',
      'Alice,0911000111,VIP',
      'Bob,0911000111,GOLD',
    ].join('\n');
    const out = await svc.importFromCsvBuffer(m.id, Buffer.from(csv, 'utf8'));
    expect(out.ok).toBe(1);
    expect(out.failed).toEqual([
      { row: 3, reason: 'duplicate phone for merchant: 0911000111' },
    ]);
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('preview: same CSV phone twice → both rows conflict (csv)', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p1`, name: 'CM' },
    });
    const csv = [
      'name,phone',
      'A,0911999001',
      'B,0911999001',
    ].join('\n');
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    expect(pre.fileHash).toBe(createHash('sha256').update(buf).digest('hex'));
    expect(pre.rows.length).toBe(2);
    expect(pre.rows[0].conflict && pre.rows[0].reasons).toContain('csv');
    expect(pre.rows[1].conflict && pre.rows[1].reasons).toContain('csv');
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('apply: fileHash mismatch → 400', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p2`, name: 'CM' },
    });
    const csv = 'name,phone\nX,0911888001\n';
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    await expect(
      svc.applyImport(m.id, Buffer.from(csv + ' '), pre.fileHash, [
        { row: 2, action: 'create' },
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CUSTOMER_IMPORT_FILE_HASH_MISMATCH',
      }),
    });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('apply: csv duplicate — one create one skip', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p3`, name: 'CM' },
    });
    const csv = ['name,phone', 'A,0911777001', 'B,0911777001'].join('\n');
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    const out = await svc.applyImport(m.id, buf, pre.fileHash, [
      { row: 2, action: 'create' },
      { row: 3, action: 'skip' },
    ]);
    expect(out.created).toBe(1);
    expect(out.skipped).toBe(1);
    const c = await prisma.customer.findFirst({
      where: { merchantId: m.id, phone: '0911777001' },
    });
    expect(c?.name).toBe('A');
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('apply: db duplicate overwrite', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p4`, name: 'CM' },
    });
    const existing = await prisma.customer.create({
      data: {
        merchantId: m.id,
        name: 'Old',
        phone: '0911666001',
        memberLevel: 'VIP',
      },
    });
    const csv = ['name,phone,memberLevel', 'NewName,0911666001,GOLD'].join('\n');
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    expect(pre.rows[0].conflict && pre.rows[0].reasons).toContain('db');
    const out = await svc.applyImport(m.id, buf, pre.fileHash, [
      {
        row: 2,
        action: 'overwrite',
        customerId: existing.id,
      },
    ]);
    expect(out.updated).toBe(1);
    const c = await prisma.customer.findUnique({ where: { id: existing.id } });
    expect(c?.name).toBe('NewName');
    expect(c?.memberLevel).toBe('GOLD');
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('apply: missing decision for row → failed', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p5`, name: 'CM' },
    });
    const csv = ['name,phone', 'A,0911555001', 'B,0911555002'].join('\n');
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    const out = await svc.applyImport(m.id, buf, pre.fileHash, [
      { row: 2, action: 'create' },
    ]);
    expect(out.created).toBe(1);
    expect(out.failed).toEqual([
      { row: 3, reason: 'missing decision for row' },
    ]);
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('apply: csv duplicate both create → second row failed', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CM-${Date.now()}-p6`, name: 'CM' },
    });
    const csv = ['name,phone', 'A,0911444001', 'B,0911444001'].join('\n');
    const buf = Buffer.from(csv, 'utf8');
    const pre = await svc.previewImport(m.id, buf);
    const out = await svc.applyImport(m.id, buf, pre.fileHash, [
      { row: 2, action: 'create' },
      { row: 3, action: 'create' },
    ]);
    expect(out.created).toBe(1);
    expect(out.failed.some((f) => f.row === 3 && f.reason.includes('one create per phone'))).toBe(
      true,
    );
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);
});

describe('CustomerService member 2.0 + contacts (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let svc: CustomerService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        CustomerModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    svc = app.get(CustomerService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('list filters by status and returns status/tags', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `M20-${Date.now()}`, name: 'M20' },
    });
    const c1 = await prisma.customer.create({
      data: { merchantId: m.id, name: 'A', status: 'ACTIVE', tags: ['vip'] },
    });
    const c2 = await prisma.customer.create({
      data: { merchantId: m.id, name: 'B', status: 'BLOCKED', tags: [] },
    });
    try {
      const list = await svc.listByMerchant(m.id);
      expect(list.length).toBeGreaterThanOrEqual(2);
      const a = list.find((x) => x.id === c1.id);
      expect(a?.status).toBe('ACTIVE');
      expect(a?.tags).toEqual(['vip']);
      const byStatus = await svc.listByMerchant(m.id, { status: 'BLOCKED' });
      expect(byStatus.find((x) => x.id === c2.id)).toBeDefined();
      expect(byStatus.find((x) => x.id === c1.id)).toBeUndefined();
    } finally {
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('merge: reassigns orders/ledger and blocks merged', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `MERG-${Date.now()}`, name: 'Merge' },
    });
    const primary = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Primary' },
    });
    const other = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Other' },
    });
    try {
      const out = await svc.merge(primary.id, [other.id]);
      expect(out.primaryId).toBe(primary.id);
      expect(out.merged).toContain(other.id);
      const blocked = await prisma.customer.findUnique({
        where: { id: other.id },
      });
      expect(blocked?.status).toBe('BLOCKED');
    } finally {
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('merge: CUSTOMER_MERGE_INVALID when secondary not found or wrong merchant', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `MERG2-${Date.now()}`, name: 'Merge2' },
    });
    const primary = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Primary' },
    });
    try {
      await expect(svc.merge(primary.id, ['non-existent-id'])).rejects.toMatchObject({
        response: { code: 'CUSTOMER_MERGE_INVALID' },
      });
    } finally {
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('merge: CUSTOMER_MERGE_INVALID when mergeIds empty or same as primary', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `MERG3-${Date.now()}`, name: 'Merge3' },
    });
    const primary = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Primary' },
    });
    try {
      await expect(svc.merge(primary.id, [])).rejects.toMatchObject({
        response: { code: 'CUSTOMER_MERGE_INVALID' },
      });
      await expect(svc.merge(primary.id, [primary.id])).rejects.toMatchObject({
        response: { code: 'CUSTOMER_MERGE_INVALID' },
      });
    } finally {
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('getById includes consumption insights (integration)', async () => {
    if (!process.env.DATABASE_URL) return;
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const m = await prisma.merchant.create({
      data: { code: `INS-${uniq}`, name: 'Insight' },
    });
    const store = await prisma.store.create({
      data: { code: `S-${uniq}`, name: 'S', merchantId: m.id },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'C' },
    });
    const catA = await prisma.category.create({
      data: { code: `CA-${uniq}`, name: 'CatA' },
    });
    const catB = await prisma.category.create({
      data: { code: `CB-${uniq}`, name: 'CatB' },
    });
    const p1 = await prisma.product.create({
      data: { sku: `SKU-${uniq}-1`, name: 'P1', categoryId: catA.id },
    });
    const p2 = await prisma.product.create({
      data: { sku: `SKU-${uniq}-2`, name: 'P2', categoryId: catB.id },
    });
    const o1 = await prisma.posOrder.create({
      data: {
        orderNumber: `O-${uniq}-1`,
        storeId: store.id,
        customerId: c.id,
        subtotalAmount: new Prisma.Decimal(100),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(100),
        items: { create: [{ productId: p1.id, quantity: 2, unitPrice: new Prisma.Decimal(50) }] },
        payments: { create: [{ method: 'CASH', amount: new Prisma.Decimal(100) }] },
      },
    });
    const o2 = await prisma.posOrder.create({
      data: {
        orderNumber: `O-${uniq}-2`,
        storeId: store.id,
        customerId: c.id,
        subtotalAmount: new Prisma.Decimal(200),
        discountAmount: new Prisma.Decimal(20),
        totalAmount: new Prisma.Decimal(180),
        items: {
          create: [
            { productId: p1.id, quantity: 1, unitPrice: new Prisma.Decimal(50) },
            { productId: p2.id, quantity: 4, unitPrice: new Prisma.Decimal(50) },
          ],
        },
        payments: { create: [{ method: 'CASH', amount: new Prisma.Decimal(180) }] },
      },
    });
    try {
      const out = await svc.getById(c.id, m.id);
      expect(out.insights).toBeDefined();
      expect(out.insights.totalSpend).toBe(280);
      expect(out.insights.ordersCount).toBe(2);
      expect(out.insights.ordersLast30d).toBe(2);
      expect(out.insights.lastOrder?.id).toBe(o2.id);
      expect(out.insights.lastOrder?.totalAmount).toBe(180);
      expect(out.insights.preferredCategories[0].categoryId).toBe(catB.id);
    } finally {
      await prisma.posOrderPayment.deleteMany({ where: { orderId: { in: [o1.id, o2.id] } } });
      await prisma.posOrderItem.deleteMany({ where: { orderId: { in: [o1.id, o2.id] } } });
      await prisma.posOrder.deleteMany({ where: { id: { in: [o1.id, o2.id] } } });
      await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
      await prisma.category.deleteMany({ where: { id: { in: [catA.id, catB.id] } } });
      await prisma.customer.deleteMany({ where: { id: c.id } });
      await prisma.store.deleteMany({ where: { id: store.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 15000);

  it('getContacts and addContact', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CON-${Date.now()}`, name: 'Contact' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'C' },
    });
    try {
      const empty = await svc.getContacts(c.id);
      expect(empty.items).toEqual([]);
      const added = await svc.addContact(c.id, {
        type: 'CALL',
        note: 'test',
        createdBy: 'agent',
      });
      expect(added.type).toBe('CALL');
      expect(added.note).toBe('test');
      expect(added.createdBy).toBe('agent');
      const list = await svc.getContacts(c.id);
      expect(list.items.length).toBe(1);
      expect(list.items[0].id).toBe(added.id);
    } finally {
      await prisma.customerContactLog.deleteMany({ where: { customerId: c.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);
});
