import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { randomUUID } from 'crypto';
import { InventoryEventType } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import {
  parseInventoryCsvRows,
  INVENTORY_IMPORT_MAX_ROWS,
} from './inventory-csv-import.util';

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
  /** 飼料／生鮮等需要控管之批號（選填） */
  batchCode?: string | null;
  /** 飼料／生鮮等需要控管之效期日（選填，ISO 字串） */
  expiryDate?: string | null;
  /** 重量單位（例如 KG, G；選填） */
  weightUnit?: string | null;
  /** 批次匯入時為 true，允許多筆共用同一 referenceId */
  skipReferenceIdCheck?: boolean;
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

export interface ExpiringInventoryFilter {
  warehouseId?: string;
  productId?: string;
  from?: string;
  to?: string;
  daysAhead?: number;
  page?: number;
  pageSize?: number;
}

export interface ReplenishmentSuggestionsFilter {
  merchantId: string;
  warehouseId?: string;
  daysLookback?: number;
  daysAhead?: number;
  safetyDays?: number;
  minSuggestedQty?: number;
  page?: number;
  pageSize?: number;
}

export interface SlowMovingFilter {
  merchantId: string;
  warehouseId?: string;
  lookbackDays?: number;
  salesThreshold?: number;
  onHandThreshold?: number;
  page?: number;
  pageSize?: number;
}

export interface ScanStocktakeInput {
  warehouseId: string;
  lines: { sku: string; actualQty: number }[];
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
      throwNotFound('INVENTORY_PRODUCT_NOT_FOUND', 'Product not found');
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }

    if (
      input.referenceId?.trim() &&
      !input.skipReferenceIdCheck &&
      (input.type === 'STOCKTAKE_GAIN' || input.type === 'STOCKTAKE_LOSS')
    ) {
      const existing = await this.prisma.inventoryEvent.findFirst({
        where: { referenceId: input.referenceId.trim() },
      });
      if (existing) {
        throwConflict('INVENTORY_REFERENCE_ID_DUPLICATE', 'Duplicate referenceId for inventory event');
      }
    }

    const event = await this.repo.appendEvent({
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: delta,
      occurredAt,
      referenceId: input.referenceId,
      note: input.note,
      batchCode: input.batchCode?.trim() || null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      weightUnit: input.weightUnit?.trim() || null,
    });

    const existing = await this.repo.findBalance(input.productId, input.warehouseId);
    const newQty = (existing?.onHandQty ?? 0) + delta;
    if (newQty < 0) {
      throwConflict('INVENTORY_INSUFFICIENT', 'Insufficient stock for this adjustment');
    }

    const balance = await this.repo.upsertBalance({
      productId: input.productId,
      warehouseId: input.warehouseId,
      onHandQty: newQty,
    });

    return { event, balance };
  }

  /**
   * 多品多倉盤點：依 actualQty 與 onHandQty 差異，批次寫入 STOCKTAKE_GAIN/LOSS
   */
  async batchStocktake(input: {
    warehouseId: string;
    lines: { productId: string; actualQty: number }[];
  }): Promise<{
    ok: number;
    failed: { lineIndex: number; reason: string }[];
    referenceId: string;
  }> {
    const whId = input.warehouseId?.trim();
    if (!whId) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'warehouseId is required');
    }
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length === 0) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'lines is required and must be non-empty');
    }
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: whId },
    });
    if (!warehouse) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }
    const productIds = lines.map((l) => l.productId).filter(Boolean);
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        warehouseId: whId,
        productId: { in: productIds },
      },
      select: { productId: true, onHandQty: true },
    });
    const onHandMap = new Map(balances.map((b) => [b.productId, b.onHandQty]));
    const referenceId = randomUUID();
    const occurredAt = new Date().toISOString();
    let ok = 0;
    const failed: { lineIndex: number; reason: string }[] = [];
    const errMsg = (e: unknown): string => {
      if (e instanceof HttpException) {
        const r = e.getResponse();
        if (typeof r === 'object' && r && 'message' in r) {
          const m = (r as { message?: string }).message;
          if (typeof m === 'string') return m;
        }
        return (e as Error).message;
      }
      if (e instanceof Error) return e.message;
      return String(e);
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const productId = (line?.productId ?? '').trim();
      const actualQty = Math.floor(Number(line?.actualQty ?? 0));
      if (!productId) {
        failed.push({ lineIndex: i + 1, reason: 'productId required' });
        continue;
      }
      const onHand = onHandMap.get(productId) ?? 0;
      const delta = actualQty - onHand;
      if (delta === 0) {
        ok++;
        continue;
      }
      try {
        await this.recordInventoryEvent({
          productId,
          warehouseId: whId,
          type: delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
          quantity: Math.abs(delta),
          occurredAt,
          referenceId,
          note: 'batch-stocktake',
          skipReferenceIdCheck: true,
        });
        ok++;
      } catch (e) {
        failed.push({ lineIndex: i + 1, reason: errMsg(e) });
      }
    }
    return { ok, failed, referenceId };
  }

  /**
   * 掃碼盤點：以 sku（之後可擴充 barcode）輸入實際數量，內部轉換為 productId 後走 batchStocktake。
   */
  async scanStocktake(input: ScanStocktakeInput) {
    const whId = input.warehouseId?.trim();
    if (!whId) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'warehouseId is required');
    }
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length === 0) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'lines is required and must be non-empty');
    }

    const codes = [...new Set(lines.map((l) => (l?.sku ?? '').trim()).filter(Boolean))];
    const products = await this.prisma.product.findMany({
      where: {
        OR: [{ sku: { in: codes } }, { barcode: { in: codes } }],
      },
      select: { id: true, sku: true, barcode: true },
    });
    const byCode = new Map<string, string>();
    for (const p of products) {
      byCode.set(p.sku, p.id);
      if (p.barcode) byCode.set(p.barcode, p.id);
    }

    const failed: { lineIndex: number; reason: string }[] = [];
    const resolved: { productId: string; actualQty: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const sku = (lines[i]?.sku ?? '').trim();
      if (!sku) {
        failed.push({ lineIndex: i + 1, reason: 'sku required' });
        continue;
      }
      const productId = byCode.get(sku);
      if (!productId) {
        failed.push({ lineIndex: i + 1, reason: `unknown sku: ${sku}` });
        continue;
      }
      resolved.push({
        productId,
        actualQty: Math.floor(Number(lines[i]?.actualQty ?? 0)),
      });
    }

    const out = await this.batchStocktake({ warehouseId: whId, lines: resolved });
    return {
      ok: out.ok,
      failed: [...failed, ...out.failed],
      referenceId: out.referenceId,
    };
  }

  /** 原子調撥：同一 transaction 內 TRANSFER_OUT（來源倉）+ TRANSFER_IN（目的倉），共用 referenceId。 */
  async transferInventory(input: TransferInventoryInput) {
    const fromId = input.fromWarehouseId?.trim();
    const toId = input.toWarehouseId?.trim();
    if (!fromId || !toId) {
      throwBadRequest('INVENTORY_TRANSFER_INVALID', 'fromWarehouseId and toWarehouseId are required');
    }
    if (fromId === toId) {
      throwBadRequest('INVENTORY_TRANSFER_SAME_WAREHOUSE', 'Source and destination warehouse must differ');
    }
    const qty = Math.abs(Number(input.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      throwBadRequest('INVENTORY_TRANSFER_INVALID_QTY', 'quantity must be a positive integer');
    }
    const occurredAt = this.resolveOccurredAt(input.occurredAt);
    const referenceId = randomUUID();

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throwNotFound('INVENTORY_PRODUCT_NOT_FOUND', 'Product not found');
    }
    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: fromId } }),
      this.prisma.warehouse.findUnique({ where: { id: toId } }),
    ]);
    if (!fromWh) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Source warehouse not found');
    }
    if (!toWh) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Destination warehouse not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const fromBal = await tx.inventoryBalance.findUnique({
        where: {
          productId_warehouseId: { productId: input.productId, warehouseId: fromId },
        },
      });
      const fromQty = fromBal?.onHandQty ?? 0;
      if (fromQty < qty) {
        throwConflict('INVENTORY_INSUFFICIENT', 'Insufficient stock at source warehouse for transfer');
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
      throwBadRequest('INVENTORY_INVALID_INPUT', 'warehouseId is required');
    }
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId.trim() },
    });
    if (!wh) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
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

  /**
   * 查詢即將到期批次：以 InventoryBalance onHandQty>0 搭配 InventoryEvent 的 batchCode/expiryDate 聚合。
   * 實作細節委由 Repository，這裡只負責解析與驗證查詢條件。
   */
  async getExpiring(filter: ExpiringInventoryFilter) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize =
      filter.pageSize && filter.pageSize > 0
        ? Math.min(filter.pageSize, 100)
        : 50;

    let from: Date | undefined;
    let to: Date | undefined;
    const now = new Date();

    if (filter.from) {
      const d = new Date(filter.from);
      if (Number.isNaN(d.getTime())) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'invalid from');
      }
      from = d;
    } else {
      from = new Date(now.toISOString().slice(0, 10));
    }

    if (filter.to) {
      const d = new Date(filter.to);
      if (Number.isNaN(d.getTime())) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'invalid to');
      }
      to = d;
    } else {
      const daysAhead = filter.daysAhead ?? 30;
      if (!Number.isFinite(daysAhead) || daysAhead <= 0 || daysAhead > 365) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'daysAhead must be between 1 and 365');
      }
      to = new Date(from);
      to.setDate(to.getDate() + daysAhead);
    }

    if (from && to && from > to) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'from must not be after to');
    }

    return this.repo.findExpiringBatches({
      warehouseId: filter.warehouseId,
      productId: filter.productId,
      from,
      to,
      page,
      pageSize,
    });
  }

  async getExpiringSummaryByProduct(filter: ExpiringInventoryFilter) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize =
      filter.pageSize && filter.pageSize > 0
        ? Math.min(filter.pageSize, 100)
        : 50;

    let from: Date | undefined;
    let to: Date | undefined;
    const now = new Date();

    if (filter.from) {
      const d = new Date(filter.from);
      if (Number.isNaN(d.getTime())) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'invalid from');
      }
      from = d;
    } else {
      from = new Date(now.toISOString().slice(0, 10));
    }

    if (filter.to) {
      const d = new Date(filter.to);
      if (Number.isNaN(d.getTime())) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'invalid to');
      }
      to = d;
    } else {
      const daysAhead = filter.daysAhead ?? 30;
      if (!Number.isFinite(daysAhead) || daysAhead <= 0 || daysAhead > 365) {
        throwBadRequest('INVENTORY_INVALID_INPUT', 'daysAhead must be between 1 and 365');
      }
      to = new Date(from);
      to.setDate(to.getDate() + daysAhead);
    }

    if (from && to && from > to) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'from must not be after to');
    }

    return this.repo.findExpiringProductSummary({
      warehouseId: filter.warehouseId,
      productId: filter.productId,
      from,
      to,
      page,
      pageSize,
    });
  }

  private computeReplenishmentSuggestion(input: {
    onHandQty: number;
    avgDailySales: number;
    daysAhead: number;
    safetyDays: number;
    minSuggestedQty: number;
  }): { targetStock: number; suggestedQty: number; reason: string } {
    const targetStockRaw =
      input.avgDailySales * (input.daysAhead + input.safetyDays);
    const targetStock = Math.max(0, Math.round(targetStockRaw * 100) / 100);
    const delta = targetStock - input.onHandQty;
    const suggestedQty = Math.max(0, Math.ceil(delta));
    if (input.avgDailySales <= 0.000001) {
      return { targetStock, suggestedQty: 0, reason: 'no recent sales' };
    }
    if (suggestedQty < input.minSuggestedQty) {
      return { targetStock, suggestedQty: 0, reason: 'below minSuggestedQty' };
    }
    if (suggestedQty <= 0) {
      return { targetStock, suggestedQty: 0, reason: 'onHand meets targetStock' };
    }
    return { targetStock, suggestedQty, reason: 'onHand below targetStock' };
  }

  /**
   * 補貨建議：以近 N 天 SALE_OUT 推估 avgDailySales，並以 InventoryBalance 當前庫存計算 suggestedQty。
   * 初版先採用預設係數（daysLookback=30, daysAhead=30, safetyDays=7），未來可改成 per-merchant 設定。
   */
  async getReplenishmentSuggestions(filter: ReplenishmentSuggestionsFilter) {
    const merchantId = filter.merchantId?.trim();
    if (!merchantId) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'merchantId is required');
    }

    const daysLookback = Math.floor(Number(filter.daysLookback ?? 30));
    if (!Number.isFinite(daysLookback) || daysLookback < 7 || daysLookback > 90) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'daysLookback must be between 7 and 90');
    }
    const daysAhead = Math.floor(Number(filter.daysAhead ?? 30));
    if (!Number.isFinite(daysAhead) || daysAhead < 1 || daysAhead > 365) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'daysAhead must be between 1 and 365');
    }
    const safetyDays = Math.floor(Number(filter.safetyDays ?? 7));
    if (!Number.isFinite(safetyDays) || safetyDays < 0 || safetyDays > 90) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'safetyDays must be between 0 and 90');
    }
    const minSuggestedQty = Math.floor(Number(filter.minSuggestedQty ?? 0));
    if (!Number.isFinite(minSuggestedQty) || minSuggestedQty < 0 || minSuggestedQty > 100_000) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'minSuggestedQty must be a non-negative integer');
    }

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize =
      filter.pageSize && filter.pageSize > 0 ? Math.min(filter.pageSize, 100) : 50;

    const warehouseId = filter.warehouseId?.trim() || undefined;
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, merchantId },
        select: { id: true },
      });
      if (!wh) {
        throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
      }
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where: { merchantId, ...(warehouseId && { id: warehouseId }) },
      select: { id: true },
    });
    const warehouseIds = warehouses.map((w) => w.id);
    if (warehouseIds.length === 0) {
      return {
        config: { daysLookback, daysAhead, safetyDays },
        items: [],
        page,
        pageSize,
        total: 0,
      };
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where: { warehouseId: { in: warehouseIds } },
      select: { productId: true, warehouseId: true, onHandQty: true },
    });
    if (balances.length === 0) {
      return {
        config: { daysLookback, daysAhead, safetyDays },
        items: [],
        page,
        pageSize,
        total: 0,
      };
    }

    const from = new Date();
    from.setDate(from.getDate() - daysLookback);

    const salesAgg = await this.prisma.inventoryEvent.groupBy({
      by: ['productId', 'warehouseId'],
      where: {
        type: 'SALE_OUT',
        warehouseId: { in: warehouseIds },
        occurredAt: { gte: from },
      },
      _sum: { quantity: true },
    });
    const soldMap = new Map<string, number>();
    for (const row of salesAgg) {
      const sumQty = row._sum.quantity ?? 0;
      const sold = Math.abs(sumQty);
      soldMap.set(`${row.productId}::${row.warehouseId}`, sold);
    }

    const computed = balances
      .map((b) => {
        const totalSold = soldMap.get(`${b.productId}::${b.warehouseId}`) ?? 0;
        const avgDailySales = totalSold / daysLookback;
        const out = this.computeReplenishmentSuggestion({
          onHandQty: b.onHandQty,
          avgDailySales,
          daysAhead,
          safetyDays,
          minSuggestedQty,
        });
        return {
          productId: b.productId,
          warehouseId: b.warehouseId,
          onHandQty: b.onHandQty,
          avgDailySales: Math.round(avgDailySales * 1000) / 1000,
          targetStock: out.targetStock,
          suggestedQty: out.suggestedQty,
          reason: out.reason,
        };
      })
      .filter((x) => x.suggestedQty > 0);

    computed.sort((a, b) => b.suggestedQty - a.suggestedQty);

    const total = computed.length;
    const start = (page - 1) * pageSize;
    const pageItems = computed.slice(start, start + pageSize);

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(pageItems.map((i) => i.productId))] } },
      select: { id: true, sku: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      config: { daysLookback, daysAhead, safetyDays },
      items: pageItems.map((i) => ({
        ...i,
        sku: productMap.get(i.productId)?.sku ?? null,
        productName: productMap.get(i.productId)?.name ?? null,
      })),
      page,
      pageSize,
      total,
    };
  }

  /**
   * 滯銷品：近 N 天銷量小於門檻且庫存大於門檻
   */
  async getSlowMoving(filter: SlowMovingFilter) {
    const merchantId = filter.merchantId?.trim();
    if (!merchantId) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'merchantId is required');
    }
    const lookbackDays = Math.floor(Number(filter.lookbackDays ?? 30));
    const salesThreshold = Math.floor(Number(filter.salesThreshold ?? 0));
    const onHandThreshold = Math.floor(Number(filter.onHandThreshold ?? 1));

    const warehouseId = filter.warehouseId?.trim() || undefined;
    const warehouses = await this.prisma.warehouse.findMany({
      where: { merchantId, ...(warehouseId && { id: warehouseId }) },
      select: { id: true },
    });
    const warehouseIds = warehouses.map((w) => w.id);
    if (warehouseIds.length === 0) {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - lookbackDays);
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: Math.min(200, Math.max(1, Math.floor(Number(filter.pageSize ?? 50)))),
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      };
    }

    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);
    const to = new Date();

    const salesAgg = await this.prisma.inventoryEvent.groupBy({
      by: ['productId', 'warehouseId'],
      where: {
        type: 'SALE_OUT',
        warehouseId: { in: warehouseIds },
        occurredAt: { gte: from, lte: to },
      },
      _sum: { quantity: true },
    });
    const soldMap = new Map<string, number>();
    for (const row of salesAgg) {
      const sold = Math.abs(Number(row._sum.quantity ?? 0));
      soldMap.set(`${row.productId}::${row.warehouseId}`, sold);
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where: { warehouseId: { in: warehouseIds } },
      select: { productId: true, warehouseId: true, onHandQty: true },
    });

    const items: Array<{
      productId: string;
      sku: string;
      name: string;
      soldQty: number;
      onHandQty: number;
      warehouseId: string;
    }> = [];
    for (const b of balances) {
      const soldQty = soldMap.get(`${b.productId}::${b.warehouseId}`) ?? 0;
      if (soldQty < salesThreshold && b.onHandQty > onHandThreshold) {
        items.push({
          productId: b.productId,
          sku: '',
          name: '',
          soldQty,
          onHandQty: b.onHandQty,
          warehouseId: b.warehouseId,
        });
      }
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products =
      productIds.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, sku: true, name: true },
          });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const i of items) {
      const p = productMap.get(i.productId);
      if (p) {
        i.sku = p.sku;
        i.name = p.name;
      }
    }

    const total = items.length;
    const page = Math.max(1, Math.floor(Number(filter.page ?? 1)));
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(filter.pageSize ?? 50))));
    const skip = (page - 1) * pageSize;
    const pageItems = items.slice(skip, skip + pageSize);

    return {
      items: pageItems,
      total,
      page,
      pageSize,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
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

  /**
   * 單倉庫存餘額 CSV（與 GET balances/enriched 同語意；最多 1 萬列；escape 同 exportEventsCsv）
   */
  async exportBalancesCsv(warehouseId: string): Promise<string> {
    if (!warehouseId?.trim()) {
      throwBadRequest('INVENTORY_INVALID_INPUT', 'warehouseId is required');
    }
    const whId = warehouseId.trim();
    const wh = await this.prisma.warehouse.findUnique({ where: { id: whId } });
    if (!wh) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }
    const balances = await this.repo.findBalancesForExport(whId);
    const productIds = [...new Set(balances.map((b) => b.productId))];
    const products =
      productIds.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, sku: true, name: true },
          });
    const map = new Map(products.map((p) => [p.id, p]));
    const header = [
      'sku',
      'name',
      'productId',
      'warehouseId',
      'onHandQty',
      'updatedAt',
    ].join(',');
    const lines = balances.map((b) =>
      [
        this.csvCell(map.get(b.productId)?.sku ?? ''),
        this.csvCell(map.get(b.productId)?.name ?? ''),
        this.csvCell(b.productId),
        this.csvCell(b.warehouseId),
        this.csvCell(b.onHandQty),
        this.csvCell(b.updatedAt.toISOString()),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  /**
   * CSV 盤點調整：每列一筆 STOCKTAKE_GAIN（quantityDelta>0）或 STOCKTAKE_LOSS（<0）；
   * 與 POST /inventory/events 同一套 recordInventoryEvent（不直接改 Balance 表而不寫事件）。
   */
  async importEventsFromCsvBuffer(buf: Buffer): Promise<{
    ok: number;
    failed: { row: number; reason: string }[];
    referenceId: string;
  }> {
    const text = buf.toString('utf8');
    const table = parseInventoryCsvRows(text);
    if (table.length === 0) {
      return {
        ok: 0,
        failed: [{ row: 0, reason: 'empty csv' }],
        referenceId: '',
      };
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const skuIdx = header.indexOf('sku');
    const whCodeIdx = header.indexOf('warehousecode');
    const whIdIdx = header.indexOf('warehouseid');
    const deltaIdx = header.indexOf('quantitydelta');
    if (skuIdx < 0 || deltaIdx < 0) {
      throwBadRequest('INVENTORY_IMPORT_HEADER', 'CSV header must include sku and quantityDelta');
    }
    if (whCodeIdx < 0 && whIdIdx < 0) {
      throwBadRequest('INVENTORY_IMPORT_HEADER', 'CSV header must include warehouseCode or warehouseId');
    }
    const dataRows = table.slice(1);
    if (dataRows.length > INVENTORY_IMPORT_MAX_ROWS) {
      throw new BadRequestException({
        message: `at most ${INVENTORY_IMPORT_MAX_ROWS} data rows`,
        code: 'INVENTORY_IMPORT_TOO_MANY_ROWS',
      });
    }
    const batchRef = randomUUID();
    let ok = 0;
    const failed: { row: number; reason: string }[] = [];
    const errMsg = (e: unknown): string => {
      if (e instanceof HttpException) {
        const r = e.getResponse();
        if (typeof r === 'object' && r && 'message' in r) {
          const m = (r as { message?: string }).message;
          if (typeof m === 'string') return m;
        }
        return e.message;
      }
      if (e instanceof Error) return e.message;
      return String(e);
    };
    for (let r = 0; r < dataRows.length; r++) {
      const cells = dataRows[r];
      const rowNum = r + 2;
      const sku = (cells[skuIdx] ?? '').trim();
      const whCode =
        whCodeIdx >= 0 ? (cells[whCodeIdx] ?? '').trim() : '';
      const whId =
        whIdIdx >= 0 ? (cells[whIdIdx] ?? '').trim() : '';
      const deltaStr = (cells[deltaIdx] ?? '').trim();
      if (!sku) {
        failed.push({ row: rowNum, reason: 'sku required' });
        continue;
      }
      if (!whCode && !whId) {
        failed.push({ row: rowNum, reason: 'warehouseCode or warehouseId required' });
        continue;
      }
      const delta = Number(deltaStr);
      if (deltaStr === '' || Number.isNaN(delta) || delta === 0) {
        failed.push({ row: rowNum, reason: 'quantityDelta must be non-zero number' });
        continue;
      }
      const product = await this.prisma.product.findUnique({
        where: { sku },
      });
      if (!product) {
        failed.push({ row: rowNum, reason: `product sku not found: ${sku}` });
        continue;
      }
      let warehouseId: string | null = null;
      if (whId) {
        const w = await this.prisma.warehouse.findUnique({
          where: { id: whId },
        });
        warehouseId = w?.id ?? null;
      } else if (whCode) {
        const w = await this.prisma.warehouse.findUnique({
          where: { code: whCode },
        });
        warehouseId = w?.id ?? null;
      }
      if (!warehouseId) {
        failed.push({
          row: rowNum,
          reason: whId
            ? `warehouse id not found: ${whId}`
            : `warehouse code not found: ${whCode}`,
        });
        continue;
      }
      try {
        await this.recordInventoryEvent({
          productId: product.id,
          warehouseId,
          type: delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
          quantity: Math.abs(delta),
          referenceId: batchRef,
          note: 'csv-import',
          skipReferenceIdCheck: true,
        });
        ok++;
      } catch (e) {
        failed.push({ row: rowNum, reason: errMsg(e) });
      }
    }
    return { ok, failed, referenceId: batchRef };
  }
}

