import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryEventType } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';

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

    const balance = await this.repo.upsertBalance({
      productId: input.productId,
      warehouseId: input.warehouseId,
      onHandQty: newQty,
    });

    return { event, balance };
  }

  async getBalances(filter: InventoryBalanceFilter) {
    return this.repo.findBalances(filter);
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
}

