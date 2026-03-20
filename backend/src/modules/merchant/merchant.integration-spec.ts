import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { MerchantModule } from './merchant.module';
import { MerchantService } from './application/merchant.service';

describe('MerchantService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let svc: MerchantService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, MerchantModule],
    }).compile();
    prisma = app.get(PrismaService);
    svc = app.get(MerchantService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('CRUD merchant, store, warehouse', async () => {
    if (!process.env.DATABASE_URL) return;
    const code = `m-${Date.now()}`;
    const merchant = await svc.createMerchant({ code, name: 'TestMerchant' });
    expect(merchant.code).toBe(code);

    const got = await svc.getMerchant(merchant.id);
    expect(got.id).toBe(merchant.id);

    const updated = await svc.updateMerchant(merchant.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    const store = await svc.createStore({ code: `s-${Date.now()}`, name: 'S1', merchantId: merchant.id });
    expect(store.merchantId).toBe(merchant.id);
    const gotStore = await svc.getStore(store.id);
    expect(gotStore.id).toBe(store.id);

    const wh = await svc.createWarehouse({ code: `w-${Date.now()}`, name: 'W1', merchantId: merchant.id, storeId: store.id });
    expect(wh.merchantId).toBe(merchant.id);
    const gotWh = await svc.getWarehouse(wh.id);
    expect(gotWh.id).toBe(wh.id);

    await svc.deleteWarehouse(wh.id);
    await svc.deleteStore(store.id);
    await svc.deleteMerchant(merchant.id);

    await expect(svc.getMerchant(merchant.id)).rejects.toMatchObject({
      response: { code: 'MERCHANT_NOT_FOUND' },
    });
  });

  it('getMerchant throws MERCHANT_NOT_FOUND for invalid id', async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(svc.getMerchant('non-existent')).rejects.toMatchObject({
      response: { code: 'MERCHANT_NOT_FOUND' },
    });
  });
});
