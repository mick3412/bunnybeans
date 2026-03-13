import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InventoryEventType } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';

export interface TransferInventoryInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string;
  occurredAt?: string;
}

export interface RecordInventoryEventInput {
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt?: string;
  referenceId?: string;
  note?: string;
}

export interface InventoryBalanceFilter {
  productIds?: string[];
  warehouseIds?: string[];
}

export interface InventoryEventFilter {
  productId?: string;
  warehouseId?: string;
  type?: InventoryEventType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InventoryRepository,
  ) {}

  private resolveOccurredAt(input?: string): Date {
    return input ? new Date(input) : new Date();
  }

  private resolveSignedQuantity(type: InventoryEventType, quantity: number): number {
    const negativeTypes: InventoryEventType[] = [
      'SALE_OUT',
      'RETURN_TO_SUPPLIER',
      'TRANSFER_OUT',
      'STOCKTAKE_LOSS',
    ];

    if (negativeTypes.includes(type)) {
      return -Math.abs(quantity);
    }

    return Math.abs(quantity);
  }

  async recordInventoryEvent(input: RecordInventoryEventInput) {
    const occurredAt = this.resolveOccurredAt(input.occurredAt);
    const delta = this.resolveSignedQuantity(input.type, input.quantity);

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'INVENTORY_PRODUCT_NOT_FOUND',
      });
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException({
        message: 'Warehouse not found',
        code: 'INVENTORY_WAREHOUSE_NOT_FOUND',
      });
    }

    const event = await this.repo.appendEvent({
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: delta,
      occurredAt,
      referenceId: input.referenceId,
      note: input.note,
    });

    const existing = await this.repo.findBalance(input.productId, input.warehouseId);
    const newQty = (existing?.onHandQty ?? 0) + delta;
    if (newQty < 0) {
      throw new ConflictException({
        message: 'Insufficient stock for this adjustment',
        code: 'INVENTORY_INSUFFICIENT',
      });
    }

    const balance = await this.repo.upsertBalance({
      productId: input.productId,
      warehouseId: input.warehouseId,
      onHandQty: newQty,
    });

    return { event, balance };
  }

  /** 原子調撥：同一 transaction 內 TRANSFER_OUT（來源倉）+ TRANSFER_IN（目的倉），共用 referenceId。 */
  async transferInventory(input: TransferInventoryInput) {
    const fromId = input.fromWarehouseId?.trim();
    const toId = input.toWarehouseId?.trim();
    if (!fromId || !toId) {
      throw new BadRequestException({
        message: 'fromWarehouseId and toWarehouseId are required',
        code: 'INVENTORY_TRANSFER_INVALID',
      });
    }
    if (fromId === toId) {
      throw new BadRequestException({
        message: 'Source and destination warehouse must differ',
        code: 'INVENTORY_TRANSFER_SAME_WAREHOUSE',
      });
    }
    const qty = Math.abs(Number(input.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      throw new BadRequestException({
        message: 'quantity must be a positive integer',
        code: 'INVENTORY_TRANSFER_INVALID_QTY',
      });
    }
    const occurredAt = this.resolveOccurredAt(input.occurredAt);
    const referenceId = randomUUID();

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'INVENTORY_PRODUCT_NOT_FOUND',
      });
    }
    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: fromId } }),
      this.prisma.warehouse.findUnique({ where: { id: toId } }),
    ]);
    if (!fromWh) {
      throw new NotFoundException({
        message: 'Source warehouse not found',
        code: 'INVENTORY_WAREHOUSE_NOT_FOUND',
      });
    }
    if (!toWh) {
      throw new NotFoundException({
        message: 'Destination warehouse not found',
        code: 'INVENTORY_WAREHOUSE_NOT_FOUND',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const fromBal = await tx.inventoryBalance.findUnique({
        where: {
          productId_warehouseId: { productId: input.productId, warehouseId: fromId },
        },
      });
      const fromQty = fromBal?.onHandQty ?? 0;
      if (fromQty < qty) {
        throw new ConflictException({
          message: 'Insufficient stock at source warehouse for transfer',
          code: 'INVENTORY_INSUFFICIENT',
        });
      }

      const outEvent = await tx.inventoryEvent.create({
        data: {
          productId: input.productId,
          warehouseId: fromId,
          type: 'TRANSFER_OUT' as InventoryEventType,
          quantity: -qty,
          occurredAt,
          referenceId,
          note: input.note ?? undefined,
        },
      });
      const inEvent = await tx.inventoryEvent.create({
        data: {
          productId: input.productId,
          warehouseId: toId,
          type: 'TRANSFER_IN' as InventoryEventType,
          quantity: qty,
          occurredAt,
          referenceId,
          note: input.note ?? undefined,
        },
      });

      await tx.inventoryBalance.upsert({
        where: {
          productId_warehouseId: { productId: input.productId, warehouseId: fromId },
        },
        create: { productId: input.productId, warehouseId: fromId, onHandQty: fromQty - qty },
        update: { onHandQty: fromQty - qty },
      });

      const toBal = await tx.inventoryBalance.findUnique({
        where: {
          productId_warehouseId: { productId: input.productId, warehouseId: toId },
        },
      });
      const toQty = (toBal?.onHandQty ?? 0) + qty;
      const balanceTo = await tx.inventoryBalance.upsert({
        where: {
          productId_warehouseId: { productId: input.productId, warehouseId: toId },
        },
        create: { productId: input.productId, warehouseId: toId, onHandQty: toQty },
        update: { onHandQty: toQty },
      });

      return {
        referenceId,
        events: [outEvent, inEvent],
        balances: {
          from: { warehouseId: fromId, onHandQty: fromQty - qty },
          to: { warehouseId: toId, onHandQty: toQty },
        },
      };
    });
  }

  async getBalances(filter: InventoryBalanceFilter) {
    return this.repo.findBalances(filter);
  }

  /** 後台用：同一倉庫下餘額列附 sku、name，避免前端 N+1 */
  async getBalancesEnriched(warehouseId: string) {
    if (!warehouseId?.trim()) {
      throw new BadRequestException({
        message: 'warehouseId is required',
        code: 'INVENTORY_INVALID_INPUT',
      });
    }
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId.trim() },
    });
    if (!wh) {
      throw new NotFoundException({
        message: 'Warehouse not found',
        code: 'INVENTORY_WAREHOUSE_NOT_FOUND',
      });
    }
    const balances = await this.repo.findBalances({
      warehouseIds: [warehouseId.trim()],
    });
    const productIds = [...new Set(balances.map((b) => b.productId))];
    if (productIds.length === 0) {
      return [];
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true },
    });
    const map = new Map(products.map((p) => [p.id, p]));
    return balances.map((b) => ({
      productId: b.productId,
      warehouseId: b.warehouseId,
      onHandQty: b.onHandQty,
      updatedAt: b.updatedAt.toISOString(),
      sku: map.get(b.productId)?.sku ?? null,
      name: map.get(b.productId)?.name ?? null,
    }));
  }

  async getEvents(filter: InventoryEventFilter) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize = filter.pageSize && filter.pageSize > 0 ? filter.pageSize : 50;

    return this.repo.findEvents({
      productId: filter.productId,
      warehouseId: filter.warehouseId,
      type: filter.type,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
      page,
      pageSize,
    });
  }

  private csvCell(v: string | number | null | undefined): string {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /** CSV 最多 10000 筆；與 GET events 相同 query */
  async exportEventsCsv(filter: InventoryEventFilter): Promise<string> {
    const rows = await this.repo.findEventsExport({
      productId: filter.productId,
      warehouseId: filter.warehouseId,
      type: filter.type,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
    });
    const header = [
      'id',
      'occurredAt',
      'type',
      'productId',
      'warehouseId',
      'quantity',
      'referenceId',
      'note',
      'createdAt',
    ].join(',');
    const lines = rows.map((r) =>
      [
        this.csvCell(r.id),
        this.csvCell(r.occurredAt.toISOString()),
        this.csvCell(r.type),
        this.csvCell(r.productId),
        this.csvCell(r.warehouseId),
        this.csvCell(r.quantity),
        this.csvCell(r.referenceId),
        this.csvCell(r.note),
        this.csvCell(r.createdAt.toISOString()),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}

