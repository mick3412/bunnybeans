import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { PosModule } from './pos.module';
import { PosSessionsService } from './application/pos-sessions.service';

describe('PosSessionsService (integration)', () => {
  let app: TestingModule;
  let service: PosSessionsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;

    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        PosModule,
      ],
    }).compile();
    service = app.get(PosSessionsService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('openSession creates session and getCurrentSession returns it', async () => {
    if (!process.env.DATABASE_URL) return;

    const store = await prisma.store.findFirst();
    if (!store) {
      throw new Error('Need at least one store in DB');
    }

    const created = await service.openSession({
      storeId: store.id,
      openingCashAmount: 5000,
      openedBy: 'test-user',
    });
    expect(created.id).toBeDefined();
    expect(created.storeId).toBe(store.id);
    expect(created.openingCashAmount).toBe(5000);
    expect(created.status).toBe('OPEN');

    const current = await service.getCurrentSession(store.id);
    expect(current).not.toBeNull();
    expect(current!.id).toBe(created.id);
    expect(current!.report).toBeDefined();
    expect(current!.report!.openingCash).toBe(5000);

    await prisma.cashRegisterSession.deleteMany({ where: { id: created.id } });
  });

  it('closeSession computes expected and difference', async () => {
    if (!process.env.DATABASE_URL) return;

    const store = await prisma.store.findFirst();
    if (!store) throw new Error('Need at least one store');

    const created = await service.openSession({
      storeId: store.id,
      openingCashAmount: 1000,
    });

    const closed = await service.closeSession(created.id, {
      actualCashAmount: 1050,
      closedBy: 'test',
    });
    expect(closed.status).toBe('CLOSED');
    expect(closed.actualCashAmount).toBe(1050);
    expect(closed.report).toBeDefined();
    expect(closed.report!.difference).toBe(50);

    await prisma.cashRegisterSession.deleteMany({ where: { id: created.id } });
  });

  it('openSession throws when store already has open session', async () => {
    if (!process.env.DATABASE_URL) return;

    const store = await prisma.store.findFirst();
    if (!store) throw new Error('Need at least one store');

    await service.openSession({ storeId: store.id, openingCashAmount: 100 });
    await expect(
      service.openSession({ storeId: store.id, openingCashAmount: 200 }),
    ).rejects.toMatchObject({ response: { code: 'POS_SESSION_ALREADY_OPEN' } });

    const session = await prisma.cashRegisterSession.findFirst({
      where: { storeId: store.id, status: 'OPEN' },
    });
    if (session) await prisma.cashRegisterSession.deleteMany({ where: { id: session.id } });
  });

  it('listSessions returns sessions by storeId and status', async () => {
    if (!process.env.DATABASE_URL) return;

    const store = await prisma.store.findFirst();
    if (!store) throw new Error('Need at least one store');

    const created = await service.openSession({
      storeId: store.id,
      openingCashAmount: 100,
      openedBy: 'list-test',
    });
    try {
      const { items, total } = await service.listSessions({
        storeId: store.id,
        status: 'OPEN',
        page: 1,
        pageSize: 10,
      });
      expect(total).toBeGreaterThanOrEqual(1);
      expect(items.some((s) => s.id === created.id)).toBe(true);
      expect(items.every((s) => s.status === 'OPEN')).toBe(true);
    } finally {
      await prisma.cashRegisterSession.deleteMany({ where: { id: created.id } });
    }
  });
});
