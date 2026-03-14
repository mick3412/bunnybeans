import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createHash } from 'crypto';
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
