import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

export interface ProductForTagResolver {
  id: string;
  tags: string[] | unknown;
  listPrice: unknown;
  salePrice: unknown;
  createdAt: Date | string;
}

export interface ResolveEffectiveTagsInput {
  products: ProductForTagResolver[];
  merchantId: string;
  storeId?: string;
}

/**
 * 即時計算商品之 effectiveTags = 手動 tags + 符合 ProductTag 自動條件的標籤。
 */
@Injectable()
export class DiscountTagResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEffectiveTags(input: ResolveEffectiveTagsInput): Promise<Map<string, string[]>> {
    const { products, merchantId, storeId } = input;
    const result = new Map<string, string[]>();

    const allTags = await this.prisma.productTag.findMany({
      where: { merchantId, showInPosDiscount: true },
      select: { name: true, autoCondition: true },
    });
    const tagsWithCondition = allTags.filter((t) => t.autoCondition != null);

    if (tagsWithCondition.length === 0) {
      for (const p of products) {
        result.set(p.id, this.manualTags(p.tags));
      }
      return result;
    }

    const productIds = products.map((p) => p.id);
    const manualByProduct = new Map(products.map((p) => [p.id, this.manualTags(p.tags)]));

    const salesQtyTags = tagsWithCondition.filter(
      (t) => this.getConditionType(t.autoCondition) === 'SALES_QTY',
    );
    const discountRatioTags = tagsWithCondition.filter(
      (t) => this.getConditionType(t.autoCondition) === 'DISCOUNT_RATIO',
    );
    const lowStockTags = tagsWithCondition.filter(
      (t) => this.getConditionType(t.autoCondition) === 'LOW_STOCK',
    );
    const newArrivalTags = tagsWithCondition.filter(
      (t) => this.getConditionType(t.autoCondition) === 'NEW_ARRIVAL',
    );

    const autoTagsByProduct = new Map<string, Set<string>>();
    for (const id of productIds) {
      autoTagsByProduct.set(id, new Set());
    }

    if (salesQtyTags.length > 0) {
      const productIdsBySales = await this.querySalesQtyProducts(merchantId, salesQtyTags);
      for (const { tagName, productIds: pids } of productIdsBySales) {
        for (const pid of pids) {
          autoTagsByProduct.get(pid)?.add(tagName);
        }
      }
    }

    for (const tag of discountRatioTags) {
      const params = (tag.autoCondition as { minPercent?: number }) ?? {};
      const minPercent = Number(params.minPercent ?? 0);
      for (const p of products) {
        if (this.hasDiscountRatio(p, minPercent)) {
          autoTagsByProduct.get(p.id)?.add(tag.name);
        }
      }
    }

    if (lowStockTags.length > 0 && storeId) {
      const productIdsLowStock = await this.queryLowStockProducts(storeId, lowStockTags);
      for (const { tagName, productIds: pids } of productIdsLowStock) {
        for (const pid of pids) {
          autoTagsByProduct.get(pid)?.add(tagName);
        }
      }
    }

    for (const tag of newArrivalTags) {
      const params = (tag.autoCondition as { withinDays?: number }) ?? {};
      const withinDays = Number(params.withinDays ?? 30);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - withinDays);
      for (const p of products) {
        const created = typeof p.createdAt === 'string' ? new Date(p.createdAt) : p.createdAt;
        if (created >= cutoff) {
          autoTagsByProduct.get(p.id)?.add(tag.name);
        }
      }
    }

    for (const p of products) {
      const manual = manualByProduct.get(p.id) ?? [];
      const auto = [...(autoTagsByProduct.get(p.id) ?? [])];
      const merged = [...new Set([...manual, ...auto])];
      result.set(p.id, merged);
    }
    return result;
  }

  private getConditionType(ac: unknown): string {
    if (ac && typeof ac === 'object' && 'type' in ac && typeof (ac as { type: unknown }).type === 'string') {
      return (ac as { type: string }).type;
    }
    return '';
  }

  private manualTags(tags: unknown): string[] {
    if (Array.isArray(tags)) {
      return tags.filter((t): t is string => typeof t === 'string');
    }
    return [];
  }

  private hasDiscountRatio(p: ProductForTagResolver, minPercent: number): boolean {
    const list = Number(p.listPrice ?? 0);
    const sale = Number(p.salePrice ?? 0);
    if (list <= 0) return false;
    const ratio = ((list - sale) / list) * 100;
    return ratio >= minPercent;
  }

  private async querySalesQtyProducts(
    merchantId: string,
    tags: { name: string; autoCondition: unknown }[],
  ): Promise<{ tagName: string; productIds: string[] }[]> {
    const results: { tagName: string; productIds: string[] }[] = [];

    for (const tag of tags) {
      const params = (tag.autoCondition as { lookbackDays?: number; minQty?: number }) ?? {};
      const lookbackDays = Number(params.lookbackDays ?? 30);
      const minQty = Number(params.minQty ?? 1);
      const since = new Date();
      since.setDate(since.getDate() - lookbackDays);

      const rows = await this.prisma.$queryRaw<{ productId: string; qty: bigint }[]>`
        SELECT oi."productId", SUM(oi.quantity)::bigint AS qty
        FROM "PosOrderItem" oi
        JOIN "PosOrder" o ON o.id = oi."orderId"
        JOIN "Store" s ON s.id = o."storeId"
        WHERE s."merchantId" = ${merchantId}
          AND o."createdAt" >= ${since}
        GROUP BY oi."productId"
        HAVING SUM(oi.quantity) >= ${minQty}
      `;

      results.push({
        tagName: tag.name,
        productIds: rows.map((r) => r.productId),
      });
    }
    return results;
  }

  private async queryLowStockProducts(
    storeId: string,
    tags: { name: string; autoCondition: unknown }[],
  ): Promise<{ tagName: string; productIds: string[] }[]> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { warehouses: { select: { id: true } } },
    });
    if (!store || store.warehouses.length === 0) return [];

    const warehouseIds = store.warehouses.map((w) => w.id);
    const results: { tagName: string; productIds: string[] }[] = [];

    for (const tag of tags) {
      const params = (tag.autoCondition as { maxQty?: number }) ?? {};
      const maxQty = Number(params.maxQty ?? 0);

      const rows = await this.prisma.$queryRaw<{ productId: string; total: bigint }[]>`
        SELECT "productId", COALESCE(SUM("onHandQty"), 0)::bigint AS total
        FROM "InventoryBalance"
        WHERE "warehouseId" IN (${Prisma.join(warehouseIds.map((id) => Prisma.sql`${id}`), ', ')})
        GROUP BY "productId"
        HAVING COALESCE(SUM("onHandQty"), 0) <= ${maxQty}
      `;

      results.push({
        tagName: tag.name,
        productIds: rows.map((r) => r.productId),
      });
    }
    return results;
  }
}
