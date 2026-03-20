import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { InventoryService } from '../../inventory/application/inventory.service';
import { FinanceService } from '../../finance/application/finance.service';
import { PosRepository } from '../infrastructure/pos.repository';
import { PromotionService } from '../../promotion/application/promotion.service';
import { LoyaltyService } from '../../loyalty/application/loyalty.service';

export interface PosOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PosPaymentInput {
  method: string;
  amount: number;
}

export interface CreatePosOrderInput {
  storeId: string;
  occurredAt?: string;
  items: PosOrderItemInput[];
  payments: PosPaymentInput[];
  customerId?: string | null;
  /** 若此單為「換貨後的新單」，帶入原單 PosOrder.id 以供追蹤／對帳 */
  exchangeFromOrderId?: string | null;
  /** 掛帳且未帶 customerId 時，後端依手機／Email 在同一 merchant 下唯一解析客戶 */
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** 為 true 時允許實收 &lt; 應收（賒帳）；須帶 customerId 或可唯一解析的 phone/email；金流寫入 SALE_RECEIVABLE + SALE_PAYMENT */
  allowCredit?: boolean;
  /** 折抵點數（須有客戶）；寫入 PointLedger BURNED，餘額不足時 400 */
  pointsToRedeem?: number;
}

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posRepo: PosRepository,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
    private readonly promotionService: PromotionService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    const rnd = Math.random().toString(36).slice(-4);
    return `POS-${datePart}-${seq}-${rnd}`;
  }

  /** 比對手機：僅數字，忽略 +886 / 0 前綴差異（末 9 碼相同視為同號） */
  private static phoneDigitsComparable(s: string): string {
    const d = s.replace(/\D/g, '');
    if (d.length >= 9) return d.slice(-9);
    return d;
  }

  async createOrder(input: CreatePosOrderInput) {
    if (!input.items?.length) {
      throwBadRequest('POS_ITEMS_EMPTY', 'items must not be empty');
    }

    const allowCredit = Boolean(input.allowCredit);
    const customerIdTrim = input.customerId?.trim() ?? '';
    const phoneTrim = input.customerPhone?.trim() ?? '';
    const emailTrim = input.customerEmail?.trim().toLowerCase() ?? '';

    if (allowCredit) {
      const hasId = Boolean(customerIdTrim);
      const hasPhone = Boolean(phoneTrim);
      const hasEmail = Boolean(emailTrim);
      if (!hasId && !hasPhone && !hasEmail) {
        throwBadRequest('POS_CREDIT_REQUIRES_CUSTOMER', 'customerId or unique customerPhone/customerEmail is required when allowCredit is true');
      }
    }

    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      include: { warehouses: true },
    });
    if (!store) {
      throwNotFound('POS_STORE_NOT_FOUND', 'Store not found');
    }

    let resolvedCustomerId: string | null = null;
    if (customerIdTrim) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerIdTrim, merchantId: store.merchantId },
      });
      if (!customer) {
        throwNotFound('POS_CUSTOMER_NOT_FOUND', 'Customer not found for this store merchant');
      }
      resolvedCustomerId = customer.id;
    } else if (allowCredit && emailTrim) {
      const rows = await this.prisma.customer.findMany({
        where: {
          merchantId: store.merchantId,
          email: { equals: emailTrim, mode: 'insensitive' },
        },
      });
      if (rows.length === 0) {
        throwNotFound('POS_CREDIT_CUSTOMER_NOT_FOUND', 'No customer found for this email in merchant');
      }
      if (rows.length > 1) {
        throwBadRequest('POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS', 'Multiple customers share this email; use customerId');
      }
      resolvedCustomerId = rows[0].id;
    } else if (allowCredit && phoneTrim) {
      const needle = PosService.phoneDigitsComparable(phoneTrim);
      const last9 = needle.length >= 9 ? needle.slice(-9) : needle;
      const candidates = await this.prisma.customer.findMany({
        where: {
          merchantId: store.merchantId,
          phone: { contains: last9 },
        },
        select: { id: true, phone: true },
      });
      const matches = candidates.filter(
        (c) =>
          c.phone &&
          PosService.phoneDigitsComparable(c.phone) === needle &&
          needle.length >= 8,
      );
      if (matches.length === 0) {
        throwNotFound('POS_CREDIT_CUSTOMER_NOT_FOUND', 'No customer found for this phone in merchant');
      }
      if (matches.length > 1) {
        throwBadRequest('POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS', 'Multiple customers share this phone; use customerId');
      }
      resolvedCustomerId = matches[0].id;
    }

    if (allowCredit && !resolvedCustomerId) {
      throwBadRequest('POS_CREDIT_REQUIRES_CUSTOMER', 'Could not resolve customer for credit');
    }

    if (!store.warehouses.length) {
      throwBadRequest('POS_STORE_NO_WAREHOUSE', 'Store has no warehouse configured for inventory');
    }

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throwNotFound('POS_PRODUCT_NOT_FOUND', `Product not found: ${missing.join(', ')}`);
    }

    let warehouse: (typeof store.warehouses)[0] | null = null;
    for (const wh of store.warehouses) {
      const balances = await this.prisma.inventoryBalance.findMany({
        where: {
          warehouseId: wh.id,
          productId: { in: productIds },
        },
      });
      const balMap = new Map(balances.map((b) => [b.productId, b.onHandQty]));
      const canFulfill = input.items.every((item) => (balMap.get(item.productId) ?? 0) >= item.quantity);
      if (canFulfill) {
        warehouse = wh;
        break;
      }
    }
    if (!warehouse) {
      throwConflict('INVENTORY_INSUFFICIENT', 'No warehouse under this store has sufficient stock for all line items');
    }

    const promo = await this.promotionService.preview({
      storeId: input.storeId,
      customerId: resolvedCustomerId,
      items: input.items,
      at: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    });
    const subtotalAmount = promo.subtotal;
    const discountAmount = promo.discount;
    const totalAmount = promo.total;
    const promotionApplied = {
      applied: promo.applied,
      messages: promo.messages,
      pointsMultiplier: promo.pointsMultiplier ?? 1,
    };
    const rawPayments = input.payments ?? [];
    for (const p of rawPayments) {
      if (typeof p.amount !== 'number' || p.amount < 0 || Number.isNaN(p.amount)) {
        throwBadRequest('POS_PAYMENT_AMOUNT_INVALID', 'each payment amount must be a non-negative number');
      }
    }
    const paymentsSum = rawPayments.reduce((s, p) => s + p.amount, 0);
    if (allowCredit) {
      if (paymentsSum - totalAmount > 0.01) {
        throwBadRequest('POS_PAYMENT_EXCEEDS_TOTAL', 'Payments total cannot exceed order total when using credit');
      }
    } else {
      if (Math.abs(paymentsSum - totalAmount) > 0.01) {
        throwBadRequest('POS_PAYMENT_MISMATCH', 'Payments total must equal order total amount');
      }
    }

    const paymentsToStore = rawPayments.filter((p) => p.amount > 0.0001);

    const pointsToRedeem = Math.floor(Number(input.pointsToRedeem));
    if (
      resolvedCustomerId &&
      Number.isFinite(pointsToRedeem) &&
      pointsToRedeem > 0
    ) {
      const balance = await this.loyaltyService.getBalance(resolvedCustomerId);
      if (balance < pointsToRedeem) {
        throwBadRequest('LOYALTY_INSUFFICIENT_POINTS', 'Points balance insufficient for redemption');
      }
    }

    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt)
      : new Date();
    const occurredAtStr = occurredAt.toISOString();

    const orderNumber = this.generateOrderNumber();
    const partyId = resolvedCustomerId ? `customer:${resolvedCustomerId}` : '';
    const warehouseId = warehouse.id;

    const order = await this.prisma.$transaction(async () => {
      const created = await this.posRepo.createOrder({
        orderNumber,
        storeId: input.storeId,
        customerId: resolvedCustomerId,
        exchangeFromOrderId: input.exchangeFromOrderId?.trim() || null,
        subtotalAmount,
        discountAmount,
        totalAmount,
        promotionApplied,
        items: input.items,
        payments: paymentsToStore,
      });

      await Promise.all(input.items.map((item) =>
        this.inventoryService.recordInventoryEvent({
          productId: item.productId,
          warehouseId,
          type: 'SALE_OUT',
          quantity: item.quantity,
          occurredAt: occurredAtStr,
          referenceId: created.id,
          note: `POS order ${orderNumber}`,
        }),
      ));

      await this.financeService.recordFinanceEvent({
        type: 'SALE_RECEIVABLE',
        partyId,
        currency: 'TWD',
        amount: totalAmount,
        taxAmount: 0,
        occurredAt: occurredAtStr,
        referenceId: created.id,
        note: allowCredit ? `POS order ${orderNumber} (credit)` : `POS order ${orderNumber}`,
      });

      if (allowCredit) {
        await Promise.all(paymentsToStore.map((p) =>
          this.financeService.recordFinanceEvent({
            type: 'SALE_PAYMENT',
            partyId,
            currency: 'TWD',
            amount: p.amount,
            taxAmount: 0,
            occurredAt: occurredAtStr,
            referenceId: created.id,
            note: `POS ${orderNumber} ${p.method}`,
          }),
        ));
      }

      return created;
    });

    const ruleIds = (promotionApplied.applied ?? [])
      .filter((a: { discount?: number }) => (a.discount ?? 0) > 0)
      .map((a: { ruleId: string }) => a.ruleId);
    await this.loyaltyService.incrementRuleUsage(ruleIds);

    if (resolvedCustomerId) {
      await this.loyaltyService.recordEarnedFromOrder({
        merchantId: store.merchantId,
        customerId: resolvedCustomerId,
        orderId: order.id,
        totalAmount,
        pointsMultiplier: promo.pointsMultiplier ?? 1,
      });
      if (pointsToRedeem > 0) {
        await this.loyaltyService.recordBurnedFromOrder({
          merchantId: store.merchantId,
          customerId: resolvedCustomerId,
          orderId: order.id,
          points: pointsToRedeem,
        });
      }
    }

    this.logger.log(`createOrder ${orderNumber} store=${input.storeId} total=${totalAmount} items=${input.items.length}`);
    return this.toOrderDetail(order);
  }

  async appendPaymentToOrder(
    orderId: string,
    input: { method: string; amount: number; occurredAt?: string },
  ) {
    const order = await this.posRepo.findById(orderId);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');
    if (typeof input.amount !== 'number' || input.amount <= 0 || Number.isNaN(input.amount)) {
      throwBadRequest('POS_PAYMENT_AMOUNT_INVALID', 'amount must be a positive number');
    }
    const method = input.method?.trim();
    if (!method) throwBadRequest('POS_PAYMENT_AMOUNT_INVALID', 'method is required');

    const total = Number(order.totalAmount);
    const paid = (order.payments ?? []).reduce((s, x) => s + Number(x.amount), 0);
    const remaining = Math.round((total - paid) * 100) / 100;
    if (remaining <= 0.01) throwBadRequest('POS_ORDER_ALREADY_SETTLED', 'Order is already fully paid');
    if (input.amount - remaining > 0.01) throwBadRequest('POS_PAYMENT_EXCEEDS_REMAINING', 'Payment amount exceeds remaining balance');

    const receivable = await this.prisma.financeEvent.findFirst({
      where: { referenceId: orderId, type: 'SALE_RECEIVABLE' },
    });
    if (!receivable) throwBadRequest('POS_CREDIT_NO_RECEIVABLE', 'No SALE_RECEIVABLE for this order; cannot append payment');

    const occurredAtStr = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

    const updated = await this.prisma.$transaction(async () => {
      const u = await this.posRepo.appendPayment(orderId, { method, amount: input.amount });
      await this.financeService.recordFinanceEvent({
        type: 'SALE_PAYMENT',
        partyId: receivable.partyId || null,
        currency: receivable.currency,
        amount: input.amount,
        taxAmount: 0,
        occurredAt: occurredAtStr,
        referenceId: orderId,
        note: `POS ${order.orderNumber} append ${method}`,
      });
      return u;
    });
    return this.toOrderDetail(updated);
  }

  async refundToOrder(
    orderId: string,
    input: { amount: number; occurredAt?: string; note?: string },
  ) {
    const order = await this.posRepo.findById(orderId);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');
    if (typeof input.amount !== 'number' || input.amount <= 0 || Number.isNaN(input.amount)) {
      throwBadRequest('POS_PAYMENT_AMOUNT_INVALID', 'amount must be a positive number');
    }

    const collected = (order.payments ?? []).reduce((s, x) => s + Number(x.amount), 0);
    if (collected < 0.01) throwBadRequest('POS_REFUND_NO_PAYMENT', 'No payment on order; cannot refund');

    const receivable = await this.prisma.financeEvent.findFirst({
      where: { referenceId: orderId, type: 'SALE_RECEIVABLE' },
    });
    if (!receivable) throwBadRequest('POS_CREDIT_NO_RECEIVABLE', 'No SALE_RECEIVABLE for this order; cannot refund');

    const refundedAgg = await this.prisma.financeEvent.aggregate({
      where: { referenceId: orderId, type: 'SALE_REFUND' },
      _sum: { amount: true },
    });
    const alreadyRefunded = Number(refundedAgg._sum.amount ?? 0);
    const maxRefund = Math.round((collected - alreadyRefunded) * 100) / 100;
    if (input.amount - maxRefund > 0.01) throwBadRequest('POS_REFUND_EXCEEDS_PAID', 'Refund amount exceeds refundable balance');

    this.logger.log(`refundToOrder ${order.orderNumber} amount=${input.amount}`);
    const occurredAtStr = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();
    await this.financeService.recordFinanceEvent({
      type: 'SALE_REFUND',
      partyId: receivable.partyId || null,
      currency: receivable.currency,
      amount: input.amount,
      taxAmount: 0,
      occurredAt: occurredAtStr,
      referenceId: orderId,
      note:
        input.note?.trim() ||
        `POS ${order.orderNumber} refund`,
    });
    return this.toOrderDetail(order);
  }

  async returnToStock(
    orderId: string,
    input: {
      items: Array<{ productId: string; quantity: number }>;
      occurredAt?: string;
    },
  ) {
    const order = await this.posRepo.findById(orderId);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');
    const items = input.items ?? [];
    if (!items.length) throwBadRequest('POS_RETURN_ITEMS_EMPTY', 'items must not be empty');

    const store = await this.prisma.store.findUnique({
      where: { id: order.storeId },
      include: { warehouses: true },
    });
    const warehouse = store?.warehouses[0];
    if (!warehouse) throwBadRequest('POS_STORE_NO_WAREHOUSE', 'Store has no warehouse');

    const soldByProduct = new Map<string, number>();
    for (const line of order.items ?? []) {
      soldByProduct.set(
        line.productId,
        (soldByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }

    const returnedAgg = await this.prisma.inventoryEvent.findMany({
      where: {
        referenceId: orderId,
        type: 'RETURN_FROM_CUSTOMER',
      },
      select: { productId: true, quantity: true },
    });
    const alreadyByProduct = new Map<string, number>();
    for (const ev of returnedAgg) {
      alreadyByProduct.set(
        ev.productId,
        (alreadyByProduct.get(ev.productId) ?? 0) + ev.quantity,
      );
    }

    const occurredAtStr = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

    for (const row of items) {
      const pid = row.productId?.trim();
      if (!pid) throwBadRequest('POS_RETURN_PRODUCT_NOT_ON_ORDER', 'each item needs productId');
      const q =
        typeof row.quantity === 'number' && row.quantity > 0
          ? Math.floor(row.quantity)
          : 0;
      if (q < 1) throwBadRequest('POS_RETURN_EXCEEDS_SOLD', 'each item quantity must be a positive integer');
      const sold = soldByProduct.get(pid);
      if (sold == null || sold < 1) throwBadRequest('POS_RETURN_PRODUCT_NOT_ON_ORDER', `Product ${pid} not on this order`);
      const already = alreadyByProduct.get(pid) ?? 0;
      if (already + q - sold > 0) throwBadRequest('POS_RETURN_EXCEEDS_SOLD', 'Return quantity exceeds sold less already returned');
      await this.inventoryService.recordInventoryEvent({
        productId: pid,
        warehouseId: warehouse.id,
        type: 'RETURN_FROM_CUSTOMER',
        quantity: q,
        occurredAt: occurredAtStr,
        referenceId: orderId,
        note: `POS ${order.orderNumber} return-to-stock`,
      });
      alreadyByProduct.set(pid, already + q);
    }

    this.logger.log(`returnToStock ${order.orderNumber} items=${items.length}`);
    const reloaded = await this.posRepo.findById(orderId);
    if (!reloaded) throw new Error('Order missing after return');
    return this.toOrderDetail(reloaded);
  }

  async getOrderById(id: string) {
    const order = await this.posRepo.findById(id);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');
    const detail = this.toOrderDetail(order);
    try {
      const sourceOrderId = detail.exchangeFromOrderId;
      const sourceId = sourceOrderId || order.id;

      const [derived, source, refundedAgg, refundEvents] = await Promise.all([
        this.prisma.posOrder.findMany({
          where: { exchangeFromOrderId: sourceId },
          select: { id: true, totalAmount: true, payments: { select: { amount: true } } },
        }),
        sourceOrderId
          ? this.prisma.posOrder.findUnique({
              where: { id: sourceId },
              select: { id: true, totalAmount: true },
            })
          : Promise.resolve({ id: order.id, totalAmount: order.totalAmount }),
        this.prisma.financeEvent.aggregate({
          where: { referenceId: sourceId, type: 'SALE_REFUND' },
          _sum: { amount: true },
        }),
        this.prisma.financeEvent.findMany({
          where: { referenceId: sourceId, type: 'SALE_REFUND' },
          orderBy: { occurredAt: 'asc' },
          select: { id: true, amount: true, occurredAt: true, note: true },
          take: 50,
        }),
      ]);

      const sourceTotal =
        source && typeof source.totalAmount === 'object' && source.totalAmount != null && 'toNumber' in source.totalAmount
          ? (source.totalAmount as { toNumber: () => number }).toNumber()
          : Number((source as any)?.totalAmount ?? 0);

      const derivedTotal = derived.reduce((s, d) => s + Number(d.totalAmount), 0);
      const deltaAmount = Math.round((derivedTotal - sourceTotal) * 100) / 100;

      const derivedPaid = derived.reduce(
        (s, d) => s + (d.payments ?? []).reduce((ss, p) => ss + Number(p.amount), 0),
        0,
      );
      const derivedRemaining = Math.round((derivedTotal - derivedPaid) * 100) / 100;

      const refunded = Number(refundedAgg._sum.amount ?? 0);
      const refundNeeded = deltaAmount < 0 ? Math.abs(deltaAmount) : 0;

      detail.exchange = {
        sourceOrderId: sourceOrderId,
        derivedOrderIds: derived.map((d) => d.id),
      };
      detail.exchangeSettlement = {
        sourceOrderId: sourceId,
        derivedOrderIds: derived.map((d) => d.id),
        sourceTotal,
        derivedTotal,
        deltaAmount,
        refund: {
          neededAmount: refundNeeded,
          refundedAmount: refunded,
          events: refundEvents.map((e) => ({
            id: e.id,
            amount: Number(e.amount),
            occurredAt: e.occurredAt.toISOString(),
            note: e.note ?? null,
          })),
        },
        topup: {
          neededAmount: deltaAmount > 0 ? deltaAmount : 0,
          remainingAmount: deltaAmount > 0 ? (derivedRemaining > 0 ? derivedRemaining : 0) : 0,
        },
        refundStatus:
          refundNeeded > 0 && refunded + 0.01 < refundNeeded ? 'REQUIRED' : refundNeeded > 0 ? 'SETTLED' : 'NOT_NEEDED',
        topupStatus:
          deltaAmount > 0 && derivedRemaining > 0.01 ? 'REQUIRED' : deltaAmount > 0 ? 'SETTLED' : 'NOT_NEEDED',
      };
    } catch {
      detail.exchange = {
        sourceOrderId: detail.exchangeFromOrderId,
        derivedOrderIds: [],
      };
      detail.exchangeSettlement = null;
    }
    return detail;
  }

  async listOrders(filter: {
    storeId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 50));
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;

    const { items, total } = await this.posRepo.findMany({
      storeId: filter.storeId,
      from,
      to,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        storeId: o.storeId,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt.toISOString(),
        customerId: o.customerId ?? null,
        customerName: o.customer?.name ?? null,
      })),
      page,
      pageSize,
      total,
    };
  }

  private csvCell(v: string | number | null | undefined): string {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /**
   * 訂單 CSV；includeLines=1 時每列一筆明細（同訂單欄位重複），最多 1 萬**明細列**
   */
  async exportOrdersCsv(filter: {
    storeId?: string;
    from?: string;
    to?: string;
    includeLines?: boolean;
  }): Promise<string> {
    const from = filter.from?.trim() ? new Date(filter.from) : undefined;
    const to = filter.to?.trim() ? new Date(filter.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throwBadRequest('POS_EXPORT_INVALID_RANGE', 'invalid from');
    if (to && Number.isNaN(to.getTime())) throwBadRequest('POS_EXPORT_INVALID_RANGE', 'invalid to');
    const num = (d: { toNumber: () => number }) => d.toNumber();
    if (filter.includeLines) {
      const lineRows = await this.posRepo.findLineRowsForExport(
        {
          storeId: filter.storeId?.trim() || undefined,
          from,
          to,
        },
        10_000,
      );
      const header = [
        'id',
        'orderNumber',
        'storeId',
        'customerId',
        'customerName',
        'subtotalAmount',
        'discountAmount',
        'totalAmount',
        'createdAt',
        'lineItemId',
        'lineProductId',
        'lineQuantity',
        'lineUnitPrice',
        'lineAmount',
      ].join(',');
      const lines = lineRows.map(({ order: o, item }) => {
        const up = item
          ? num(item.unitPrice as { toNumber: () => number })
          : 0;
        const qty = item?.quantity ?? 0;
        const amt =
          item != null ? Math.round(qty * up * 100) / 100 : '';
        return [
          this.csvCell(o.id),
          this.csvCell(o.orderNumber),
          this.csvCell(o.storeId),
          this.csvCell(o.customerId),
          this.csvCell(o.customer?.name ?? ''),
          this.csvCell(num(o.subtotalAmount as { toNumber: () => number })),
          this.csvCell(num(o.discountAmount as { toNumber: () => number })),
          this.csvCell(num(o.totalAmount as { toNumber: () => number })),
          this.csvCell(o.createdAt.toISOString()),
          this.csvCell(item?.id ?? ''),
          this.csvCell(item?.productId ?? ''),
          this.csvCell(qty),
          this.csvCell(up),
          this.csvCell(amt),
        ].join(',');
      });
      return [header, ...lines].join('\n');
    }
    const rows = await this.posRepo.findManyForExport({
      storeId: filter.storeId?.trim() || undefined,
      from,
      to,
    });
    const header = [
      'id',
      'orderNumber',
      'storeId',
      'customerId',
      'customerName',
      'subtotalAmount',
      'discountAmount',
      'totalAmount',
      'createdAt',
    ].join(',');
    const lines = rows.map((o) =>
      [
        this.csvCell(o.id),
        this.csvCell(o.orderNumber),
        this.csvCell(o.storeId),
        this.csvCell(o.customerId),
        this.csvCell(o.customer?.name ?? ''),
        this.csvCell(num(o.subtotalAmount as { toNumber: () => number })),
        this.csvCell(num(o.discountAmount as { toNumber: () => number })),
        this.csvCell(num(o.totalAmount as { toNumber: () => number })),
        this.csvCell(o.createdAt.toISOString()),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  private toOrderDetail(order: {
    id: string;
    orderNumber: string;
    storeId: string;
    customerId?: string | null;
    exchangeFromOrderId?: string | null;
    customer?: { id: string; name: string; code: string | null } | null;
    subtotalAmount?: { toNumber: () => number } | number;
    discountAmount?: { toNumber: () => number } | number;
    promotionApplied?: unknown;
    totalAmount: { toNumber: () => number };
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: { toNumber: () => number };
    }>;
    payments?: Array<{
      method: string;
      amount: { toNumber: () => number } | number;
    }>;
  }) {
    const payments = (order.payments ?? []).map((p) => ({
      method: p.method,
      amount:
        typeof p.amount === 'object' && p.amount != null && 'toNumber' in p.amount
          ? (p.amount as { toNumber: () => number }).toNumber()
          : Number(p.amount),
    }));
    const num = (v: unknown) =>
      typeof v === 'object' && v != null && 'toNumber' in v
        ? (v as { toNumber: () => number }).toNumber()
        : Number(v ?? 0);
    const total = num(order.totalAmount);
    const subtotal = num(order.subtotalAmount ?? total);
    const discount = num(order.discountAmount ?? 0);
    const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
    const remainingAmount = Math.round((total - paidAmount) * 100) / 100;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
      customerId: order.customerId ?? null,
      exchangeFromOrderId: order.exchangeFromOrderId ?? null,
      exchange: null as null | { sourceOrderId: string | null; derivedOrderIds: string[] },
      exchangeSettlement: null as
        | null
        | {
            sourceOrderId: string;
            derivedOrderIds: string[];
            sourceTotal: number;
            derivedTotal: number;
            deltaAmount: number;
            refund: {
              neededAmount: number;
              refundedAmount: number;
              events: Array<{
                id: string;
                amount: number;
                occurredAt: string;
                note: string | null;
              }>;
            };
            topup: {
              neededAmount: number;
              remainingAmount: number;
            };
            refundStatus: 'NOT_NEEDED' | 'REQUIRED' | 'SETTLED';
            topupStatus: 'NOT_NEEDED' | 'REQUIRED' | 'SETTLED';
          },
      customerName: order.customer?.name ?? null,
      customerCode: order.customer?.code ?? null,
      subtotalAmount: subtotal,
      discountAmount: discount,
      promotionApplied: order.promotionApplied ?? null,
      totalAmount: total,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice:
          typeof i.unitPrice === 'object' && 'toNumber' in i.unitPrice
            ? (i.unitPrice as { toNumber: () => number }).toNumber()
            : Number(i.unitPrice),
      })),
      payments,
      paidAmount,
      remainingAmount: remainingAmount > 0 ? remainingAmount : 0,
      credit: remainingAmount > 0.01,
    };
  }
}
