/**
 * Integration test: Inventory record event → balance updated; get balances / events.
 * Requires DATABASE_URL and a migrated database (e.g. pnpm prisma:db:push).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { InventoryModule } from './inventory.module';
import { InventoryService } from './application/inventory.service';

describe('InventoryService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping Inventory integration test');
      return;
    }
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        InventoryModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    inventoryService = app.get(InventoryService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('records PURCHASE_IN event and updates balance; getBalances and getEvents return expected data', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-INV-${Date.now()}`, name: 'Inventory Test Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-INV-${Date.now()}`,
        name: 'Inventory Test Warehouse',
        merchantId: (await prisma.merchant.create({
          data: { code: `M-INV-${Date.now()}`, name: 'Inv Test Merchant' },
        })).id,
      },
    });

    const result = await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 20,
      occurredAt: new Date().toISOString(),
      note: 'Integration test',
    });

    expect(result.event).toBeDefined();
    expect(result.event.id).toBeDefined();
    expect(result.event.quantity).toBe(20);
    expect(result.balance).toBeDefined();
    expect(result.balance.onHandQty).toBe(20);

    const balances = await inventoryService.getBalances({
      productIds: [product.id],
      warehouseIds: [warehouse.id],
    });
    expect(balances.length).toBe(1);
    expect(balances[0].productId).toBe(product.id);
    expect(balances[0].warehouseId).toBe(warehouse.id);
    expect(balances[0].onHandQty).toBe(20);

    const eventsResult = await inventoryService.getEvents({
      productId: product.id,
      warehouseId: warehouse.id,
      page: 1,
      pageSize: 10,
    });
    expect(eventsResult.items.length).toBeGreaterThanOrEqual(1);
    expect(eventsResult.total).toBeGreaterThanOrEqual(1);
    const purchaseEvent = eventsResult.items.find((e) => e.quantity === 20);
    expect(purchaseEvent).toBeDefined();

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.deleteMany({
      where: { id: warehouse.merchantId },
    });
  }, 15000);

  it('getBalancesEnriched returns sku and name for warehouse', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-ENR-${Date.now()}`, name: 'Enriched Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-ENR-${Date.now()}`,
        name: 'Enriched Warehouse',
        merchantId: (
          await prisma.merchant.create({
            data: { code: `M-ENR-${Date.now()}`, name: 'Enr Merchant' },
          })
        ).id,
      },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 3,
    });
    const enriched = await inventoryService.getBalancesEnriched(warehouse.id);
    expect(enriched.length).toBe(1);
    expect(enriched[0].sku).toBe(product.sku);
    expect(enriched[0].name).toBe('Enriched Product');
    expect(enriched[0].onHandQty).toBe(3);

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: warehouse.merchantId } });
  }, 15000);

  it('exportBalancesCsv returns header and row with sku,name,onHandQty', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-CSV-${Date.now()}`, name: 'CSV Balance Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-CSV-${Date.now()}`,
        name: 'CSV Warehouse',
        merchantId: (
          await prisma.merchant.create({
            data: { code: `M-CSV-${Date.now()}`, name: 'CSV Merchant' },
          })
        ).id,
      },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 7,
    });
    const csv = await inventoryService.exportBalancesCsv(warehouse.id);
    expect(csv).toContain('sku,name,productId,warehouseId,onHandQty,updatedAt');
    expect(csv).toContain(product.sku);
    expect(csv).toContain('CSV Balance Product');
    expect(csv).toContain(',7,');

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: warehouse.merchantId } });
  }, 15000);

  it('transferInventory moves qty atomically between warehouses', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-TR-${Date.now()}`, name: 'Transfer Merchant' },
    });
    const wA = await prisma.warehouse.create({
      data: { code: `W-TR-A-${Date.now()}`, name: 'Transfer A', merchantId: merchant.id },
    });
    const wB = await prisma.warehouse.create({
      data: { code: `W-TR-B-${Date.now()}`, name: 'Transfer B', merchantId: merchant.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-TR-${Date.now()}`, name: 'Transfer Product' },
    });

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: wA.id,
      type: 'PURCHASE_IN',
      quantity: 50,
    });

    const out = await inventoryService.transferInventory({
      fromWarehouseId: wA.id,
      toWarehouseId: wB.id,
      productId: product.id,
      quantity: 15,
      note: 'integration transfer',
    });

    expect(out.referenceId).toBeDefined();
    expect(out.balances.from.onHandQty).toBe(35);
    expect(out.balances.to.onHandQty).toBe(15);

    const evs = await prisma.inventoryEvent.findMany({
      where: { referenceId: out.referenceId },
      orderBy: { type: 'asc' },
    });
    expect(evs.length).toBe(2);
    expect(evs.some((e) => e.type === 'TRANSFER_OUT' && e.quantity === -15)).toBe(true);
    expect(evs.some((e) => e.type === 'TRANSFER_IN' && e.quantity === 15)).toBe(true);

    await prisma.inventoryEvent.deleteMany({ where: { productId: product.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: wA.id } });
    await prisma.warehouse.delete({ where: { id: wB.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('importEventsFromCsvBuffer: 2 gains + 1 bad sku; balance += 3', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-CIMP-${Date.now()}`, name: 'Csv Import Merchant' },
    });
    const whCode = `W-CIMP-${Date.now()}`;
    const warehouse = await prisma.warehouse.create({
      data: {
        code: whCode,
        name: 'Csv Import WH',
        merchantId: merchant.id,
      },
    });
    const skuOk = `SKU-CIMP-${Date.now()}`;
    const product = await prisma.product.create({
      data: { sku: skuOk, name: 'Csv Import Product' },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 10,
      note: 'seed for import test',
    });

    const csv = [
      'sku,warehouseCode,quantityDelta',
      `${skuOk},${whCode},2`,
      `${skuOk},${whCode},1`,
      `NO-SUCH-SKU,${whCode},1`,
    ].join('\n');

    const out = await inventoryService.importEventsFromCsvBuffer(
      Buffer.from(csv, 'utf8'),
    );
    expect(out.ok).toBe(2);
    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].row).toBe(4);
    expect(out.failed[0].reason).toContain('not found');

    const bal = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });
    expect(bal?.onHandQty).toBe(13);

    await prisma.inventoryEvent.deleteMany({
      where: { referenceId: out.referenceId },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);
});
