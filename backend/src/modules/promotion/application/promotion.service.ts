import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PromotionRepository } from '../infrastructure/promotion.repository';
import {
  applyPromotions,
  describeRule,
  type PromotionRuleInput,
  type CartLine,
  type Condition,
  type Action,
} from './promotion-engine';

function parseJsonArray<T>(v: unknown, fallback: T[]): T[] {
  if (Array.isArray(v)) return v as T[];
  return fallback;
}

function toRuleInput(row: {
  id: string;
  name: string;
  priority: number;
  draft: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  exclusive: boolean;
  firstPurchaseOnly: boolean;
  memberLevels: unknown;
  conditions: unknown;
  actions: unknown;
}): PromotionRuleInput {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    draft: row.draft,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    exclusive: row.exclusive,
    firstPurchaseOnly: row.firstPurchaseOnly,
    memberLevels: parseJsonArray<string>(row.memberLevels, []),
    conditions: parseJsonArray<Condition>(row.conditions, []),
    actions: parseJsonArray<Action>(row.actions, []),
  };
}

@Injectable()
export class PromotionService {
  constructor(
    private readonly repo: PromotionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(
    merchantId: string,
    query: { status?: string; q?: string },
  ) {
    const rows = await this.repo.findByMerchant(merchantId, query);
    const at = new Date();
    return rows.map((r) => ({
      id: r.id,
      merchantId: r.merchantId,
      name: r.name,
      priority: r.priority,
      draft: r.draft,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      exclusive: r.exclusive,
      firstPurchaseOnly: r.firstPurchaseOnly,
      memberLevels: r.memberLevels,
      conditions: r.conditions,
      actions: r.actions,
      status: this.repo.displayStatus(r, at),
      summary: describeRule({
        conditions: parseJsonArray<Condition>(r.conditions, []),
        actions: parseJsonArray<Action>(r.actions, []),
      }),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async get(id: string) {
    const r = await this.repo.findById(id);
    if (!r) {
      throw new NotFoundException({
        message: 'Promotion rule not found',
        code: 'PROMOTION_NOT_FOUND',
      });
    }
    const at = new Date();
    return {
      id: r.id,
      merchantId: r.merchantId,
      name: r.name,
      priority: r.priority,
      draft: r.draft,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      exclusive: r.exclusive,
      firstPurchaseOnly: r.firstPurchaseOnly,
      memberLevels: r.memberLevels,
      conditions: r.conditions,
      actions: r.actions,
      status: this.repo.displayStatus(r, at),
      summary: describeRule({
        conditions: parseJsonArray<Condition>(r.conditions, []),
        actions: parseJsonArray<Action>(r.actions, []),
      }),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async create(
    merchantId: string,
    body: {
      name: string;
      priority?: number;
      draft?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      exclusive?: boolean;
      firstPurchaseOnly?: boolean;
      memberLevels?: string[];
      conditions?: Condition[];
      actions?: Action[];
    },
  ) {
    return this.repo.create({
      merchant: { connect: { id: merchantId } },
      name: body.name.trim(),
      priority: body.priority ?? 100,
      draft: body.draft ?? true,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      exclusive: body.exclusive ?? false,
      firstPurchaseOnly: body.firstPurchaseOnly ?? false,
      memberLevels: body.memberLevels ?? [],
      conditions: (body.conditions ?? []) as object[],
      actions: (body.actions ?? []) as object[],
    });
  }

  async update(
    id: string,
    merchantId: string,
    body: Partial<{
      name: string;
      priority: number;
      draft: boolean;
      startsAt: string | null;
      endsAt: string | null;
      exclusive: boolean;
      firstPurchaseOnly: boolean;
      memberLevels: string[];
      conditions: Condition[];
      actions: Action[];
    }>,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.merchantId !== merchantId) {
      throw new NotFoundException({
        message: 'Promotion rule not found',
        code: 'PROMOTION_NOT_FOUND',
      });
    }
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = body.name.trim();
    if (body.priority != null) data.priority = body.priority;
    if (body.draft != null) data.draft = body.draft;
    if (body.startsAt !== undefined)
      data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined)
      data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.exclusive != null) data.exclusive = body.exclusive;
    if (body.firstPurchaseOnly != null)
      data.firstPurchaseOnly = body.firstPurchaseOnly;
    if (body.memberLevels != null) data.memberLevels = body.memberLevels;
    if (body.conditions != null) data.conditions = body.conditions as object[];
    if (body.actions != null) data.actions = body.actions as object[];
    return this.repo.update(id, data);
  }

  async remove(id: string, merchantId: string) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.merchantId !== merchantId) {
      throw new NotFoundException({
        message: 'Promotion rule not found',
        code: 'PROMOTION_NOT_FOUND',
      });
    }
    await this.repo.delete(id);
  }

  async reorder(merchantId: string, ids: string[]) {
    if (!merchantId?.trim()) {
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'PROMOTION_BODY_INVALID',
      });
    }
    if (!ids.length) {
      throw new BadRequestException({
        message: 'ids required',
        code: 'PROMOTION_REORDER_EMPTY',
      });
    }
    const cleaned = ids.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!cleaned.length) {
      throw new BadRequestException({
        message: 'ids required',
        code: 'PROMOTION_REORDER_EMPTY',
      });
    }
    const uniq = [...new Set(cleaned)];
    if (uniq.length !== cleaned.length) {
      throw new BadRequestException({
        message: 'duplicate ids',
        code: 'PROMOTION_REORDER_DUPLICATE_IDS',
      });
    }
    const count = await this.prisma.promotionRule.count({
      where: { merchantId: merchantId.trim(), id: { in: uniq } },
    });
    if (count !== uniq.length) {
      throw new BadRequestException({
        message: 'some ids not found for merchant',
        code: 'PROMOTION_NOT_FOUND',
      });
    }

    // Must include all rules for the merchant; partial reorder is rejected for UI consistency.
    const totalForMerchant = await this.prisma.promotionRule.count({
      where: { merchantId: merchantId.trim() },
    });
    if (uniq.length !== totalForMerchant) {
      throw new BadRequestException({
        message: 'ids must include all promotion rules for merchant',
        code: 'PROMOTION_REORDER_INVALID',
      });
    }

    await this.repo.reorder(merchantId.trim(), uniq);
  }

  /**
   * POS / 預覽：依門市商家載入規則並試算
   */
  async preview(input: {
    storeId: string;
    customerId?: string | null;
    items: { productId: string; quantity: number; unitPrice: number }[];
    at?: Date;
  }) {
    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
    });
    if (!store) {
      throw new NotFoundException({
        message: 'Store not found',
        code: 'POS_STORE_NOT_FOUND',
      });
    }
    const rules = await this.prisma.promotionRule.findMany({
      where: { merchantId: store.merchantId },
      orderBy: { priority: 'asc' },
    });
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const tagById = new Map(
      products.map((p) => [p.id, parseJsonArray<string>(p.tags, [])]),
    );
    const lines: CartLine[] = input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      tags: tagById.get(i.productId) ?? [],
    }));

    let isFirstPurchase = true;
    let memberLevel: string | null = null;
    if (input.customerId?.trim()) {
      const c = await this.prisma.customer.findFirst({
        where: { id: input.customerId.trim(), merchantId: store.merchantId },
      });
      if (c) {
        memberLevel = c.memberLevel?.trim() || null;
        const orderCount = await this.prisma.posOrder.count({
          where: { customerId: c.id },
        });
        isFirstPurchase = orderCount === 0;
      }
    }

    const at = input.at ?? new Date();
    const inputs = rules.map(toRuleInput);
    const result = applyPromotions(inputs, lines, {
      at,
      isFirstPurchase,
      memberLevel,
    });
    return {
      subtotal: result.subtotal,
      discount: result.discount,
      total: result.total,
      applied: result.applied,
      messages: result.previewLines,
      pointsMultiplier: result.pointsMultiplier,
    };
  }

  /**
   * 促銷成效追蹤：區間內每條規則的觸發次數、折讓合計、帶動銷售額
   */
  async getEffectiveness(
    merchantId: string,
    filter: { from?: string; to?: string; preset?: string },
  ) {
    const REPORT_PRESETS = ['today', 'last7d', 'last30d', 'currentMonth', 'last60d', 'lastHalfYear'] as const;
    let presetUsed: string | undefined;
    let start: Date;
    let end: Date;
    if (filter.from?.trim() && filter.to?.trim()) {
      const s = new Date(filter.from.trim());
      const e = new Date(filter.to.trim());
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        throw new BadRequestException({ message: 'Invalid from or to date', code: 'REPORT_INVALID_RANGE' });
      }
      start = s;
      start.setHours(0, 0, 0, 0);
      end = e;
      end.setHours(23, 59, 59, 999);
      if (start.getTime() > end.getTime()) {
        throw new BadRequestException({ message: 'from must be before or equal to to', code: 'REPORT_INVALID_RANGE' });
      }
    } else {
      const p = REPORT_PRESETS.includes((filter.preset ?? '') as any) ? (filter.preset as string) : 'last30d';
      presetUsed = p;
      const now = new Date();
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      switch (p) {
        case 'today':
          break;
        case 'last7d':
          start.setDate(start.getDate() - 6);
          break;
        case 'last30d':
          start.setDate(start.getDate() - 29);
          break;
        case 'currentMonth':
          start.setDate(1);
          break;
        case 'last60d':
          start.setDate(start.getDate() - 59);
          break;
        case 'lastHalfYear':
          start.setDate(start.getDate() - 179);
          break;
        default:
          start.setDate(start.getDate() - 29);
          presetUsed = 'last30d';
      }
    }

    const orders = await this.prisma.posOrder.findMany({
      where: {
        store: { merchantId },
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        totalAmount: true,
        promotionApplied: true,
      },
    });

    const ruleStats = new Map<
      string,
      { triggerCount: number; discountTotal: number; drivenRevenue: number }
    >();

    for (const o of orders) {
      const raw = o.promotionApplied as
        | { applied?: Array<{ ruleId?: string; discount?: number }> }
        | null
        | undefined;
      const applied = Array.isArray(raw?.applied) ? raw!.applied : [];
      const totalAmount = Number(o.totalAmount ?? 0);

      for (const a of applied) {
        const ruleId = typeof a?.ruleId === 'string' ? a.ruleId.trim() : '';
        if (!ruleId) continue;
        const discount = typeof a?.discount === 'number' ? a.discount : 0;
        const cur = ruleStats.get(ruleId) ?? {
          triggerCount: 0,
          discountTotal: 0,
          drivenRevenue: 0,
        };
        cur.triggerCount += 1;
        cur.discountTotal += discount;
        cur.drivenRevenue += totalAmount;
        ruleStats.set(ruleId, cur);
      }
    }

    const rules = await this.prisma.promotionRule.findMany({
      where: { merchantId },
      select: { id: true, name: true },
    });
    const ruleNames = new Map(rules.map((r) => [r.id, r.name]));

    const items = rules.map((r) => {
      const s = ruleStats.get(r.id) ?? {
        triggerCount: 0,
        discountTotal: 0,
        drivenRevenue: 0,
      };
      return {
        ruleId: r.id,
        ruleName: r.name,
        triggerCount: s.triggerCount,
        discountTotal: s.discountTotal,
        drivenRevenue: s.drivenRevenue,
      };
    });

    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      ...(presetUsed && { period: { preset: presetUsed, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) } }),
      items,
    };
  }
}
