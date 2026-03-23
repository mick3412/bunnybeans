import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { PosModule } from './pos.module';
import { PosHeldCartsService } from './application/pos-held-carts.service';

describe('PosHeldCartsService (integration)', () => {
  let app: TestingModule;
  let service: PosHeldCartsService;
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
    service = app.get(PosHeldCartsService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('hold → list → retrieve 流程', async () => {
    if (!process.env.DATABASE_URL) return;

    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();
    if (!store || !product) throw new Error('Need store and product in DB');

    const items = [{ productId: product.id, name: product.name, unitPrice: 99, quantity: 2 }];

    const held = await service.holdCart({ storeId: store.id, items });
    expect(held.id).toBeDefined();
    expect(held.storeId).toBe(store.id);
    expect(held.items).toEqual(items);
    expect(held.subtotal).toBe(198);
    expect(held.total).toBe(198);
    expect(held.heldAt).toBeDefined();

    const list = await service.listHeldCarts(store.id);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((c) => c.id === held.id)).toBe(true);

    const retrieved = await service.retrieveAndDelete(held.id);
    expect(retrieved.items).toEqual(items);
    expect(retrieved.subtotal).toBe(198);
    expect(retrieved.total).toBe(198);

    const afterList = await service.listHeldCarts(store.id);
    expect(afterList.some((c) => c.id === held.id)).toBe(false);
  });

  it('hold 門市不存在拋 POS_STORE_NOT_FOUND', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.findFirst();
    if (!product) return;

    await expect(
      service.holdCart({
        storeId: '00000000-0000-0000-0000-000000000000',
        items: [{ productId: product.id, name: 'x', unitPrice: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      response: { code: 'POS_STORE_NOT_FOUND' },
    });
  });

  it('hold 缺 storeId 或 items 空拋錯', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.findFirst();
    if (!product) return;

    await expect(service.holdCart({ storeId: '', items: [{ productId: product.id, name: 'x', unitPrice: 1, quantity: 1 }] })).rejects.toMatchObject({
      response: { code: 'POS_HELD_CART_STORE_REQUIRED' },
    });

    const store = await prisma.store.findFirst();
    if (!store) return;

    await expect(service.holdCart({ storeId: store.id, items: [] })).rejects.toMatchObject({
      response: { code: 'POS_HELD_CART_ITEMS_EMPTY' },
    });
  });

  it('retrieve 不存在的 id 拋 POS_HELD_CART_NOT_FOUND', async () => {
    if (!process.env.DATABASE_URL) return;

    await expect(service.retrieveAndDelete('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      response: { code: 'POS_HELD_CART_NOT_FOUND' },
    });
  });
});
