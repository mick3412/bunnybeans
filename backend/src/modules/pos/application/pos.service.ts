import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryService } from '../../inventory/application/inventory.service';
import { FinanceService } from '../../finance/application/finance.service';
import { PosRepository } from '../infrastructure/pos.repository';
import { PromotionService } from '../../promotion/application/promotion.service';

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
  /** 掛帳且未帶 customerId 時，後端依手機／Email 在同一 merchant 下唯一解析客戶 */
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** 為 true 時允許實收 &lt; 應收（賒帳）；須帶 customerId 或可唯一解析的 phone/email；金流寫入 SALE_RECEIVABLE + SALE_PAYMENT */
  allowCredit?: boolean;
}

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posRepo: PosRepository,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
    private readonly promotionService: PromotionService,
  ) {}

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    return `POS-${datePart}-${seq}`;
  }

  /** 比對手機：僅數字，忽略 +886 / 0 前綴差異（末 9 碼相同視為同號） */
  private static phoneDigitsComparable(s: string): string {
    const d = s.replace(/\D/g, '');
    if (d.length >= 9) return d.slice(-9);
    return d;
  }

  async createOrder(input: CreatePosOrderInput) {
    if (!input.items?.length) {
      throw new BadRequestException({
        message: 'items must not be empty',
        code: 'POS_ITEMS_EMPTY',
      });
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
        throw new BadRequestException({
          message:
            'customerId or unique customerPhone/customerEmail is required when allowCredit is true',
          code: 'POS_CREDIT_REQUIRES_CUSTOMER',
        });
      }
    }

    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      include: { warehouses: true },
    });
    if (!store) {
      throw new NotFoundException({
        message: 'Store not found',
        code: 'POS_STORE_NOT_FOUND',
      });
    }

    let resolvedCustomerId: string | null = null;
    if (customerIdTrim) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerIdTrim, merchantId: store.merchantId },
      });
      if (!customer) {
        throw new NotFoundException({
          message: 'Customer not found for this store merchant',
          code: 'POS_CUSTOMER_NOT_FOUND',
        });
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
        throw new NotFoundException({
          message: 'No customer found for this email in merchant',
          code: 'POS_CREDIT_CUSTOMER_NOT_FOUND',
        });
      }
      if (rows.length > 1) {
        throw new BadRequestException({
          message: 'Multiple customers share this email; use customerId',
          code: 'POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS',
        });
      }
      resolvedCustomerId = rows[0].id;
    } else if (allowCredit && phoneTrim) {
      const needle = PosService.phoneDigitsComparable(phoneTrim);
      const candidates = await this.prisma.customer.findMany({
        where: {
          merchantId: store.merchantId,
          phone: { not: null },
        },
      });
      const matches = candidates.filter(
        (c) =>
          c.phone &&
          PosService.phoneDigitsComparable(c.phone) === needle &&
          needle.length >= 8,
      );
      if (matches.length === 0) {
        throw new NotFoundException({
          message: 'No customer found for this phone in merchant',
          code: 'POS_CREDIT_CUSTOMER_NOT_FOUND',
        });
      }
      if (matches.length > 1) {
        throw new BadRequestException({
          message: 'Multiple customers share this phone; use customerId',
          code: 'POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS',
        });
      }
      resolvedCustomerId = matches[0].id;
    }

    if (allowCredit && !resolvedCustomerId) {
      throw new BadRequestException({
        message: 'Could not resolve customer for credit',
        code: 'POS_CREDIT_REQUIRES_CUSTOMER',
      });
    }

    if (!store.warehouses.length) {
      throw new BadRequestException({
        message: 'Store has no warehouse configured for inventory',
        code: 'POS_STORE_NO_WAREHOUSE',
      });
    }

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException({
        message: `Product not found: ${missing.join(', ')}`,
        code: 'POS_PRODUCT_NOT_FOUND',
      });
    }

    /** 多倉掛同一門市時，勿死用 warehouses[0]（測試倉可能無量）；選第一個能滿足整單的倉 */
    let warehouse: (typeof store.warehouses)[0] | null = null;
    for (const wh of store.warehouses) {
      let canFulfill = true;
      for (const item of input.items) {
        const bal = await this.prisma.inventoryBalance.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: wh.id,
            },
          },
        });
        if ((bal?.onHandQty ?? 0) < item.quantity) {
          canFulfill = false;
          break;
        }
      }
      if (canFulfill) {
        warehouse = wh;
        break;
      }
    }
    if (!warehouse) {
      throw new ConflictException({
        message:
          'No warehouse under this store has sufficient stock for all line items',
        code: 'INVENTORY_INSUFFICIENT',
      });
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
    };
    const rawPayments = input.payments ?? [];
    for (const p of rawPayments) {
      if (typeof p.amount !== 'number' || p.amount < 0 || Number.isNaN(p.amount)) {
        throw new BadRequestException({
          message: 'each payment amount must be a non-negative number',
          code: 'POS_PAYMENT_AMOUNT_INVALID',
        });
      }
    }
    const paymentsSum = rawPayments.reduce((s, p) => s + p.amount, 0);
    if (allowCredit) {
      if (paymentsSum - totalAmount > 0.01) {
        throw new BadRequestException({
          message: 'Payments total cannot exceed order total when using credit',
          code: 'POS_PAYMENT_EXCEEDS_TOTAL',
        });
      }
    } else {
      if (Math.abs(paymentsSum - totalAmount) > 0.01) {
        throw new BadRequestException({
          message: 'Payments total must equal order total amount',
          code: 'POS_PAYMENT_MISMATCH',
        });
      }
    }

    const paymentsToStore = rawPayments.filter((p) => p.amount > 0.0001);

    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt)
      : new Date();
    const occurredAtStr = occurredAt.toISOString();

    const orderNumber = this.generateOrderNumber();
    const order = await this.posRepo.createOrder({
      orderNumber,
      storeId: input.storeId,
      customerId: resolvedCustomerId,
      subtotalAmount,
      discountAmount,
      totalAmount,
      promotionApplied,
      items: input.items,
      payments: paymentsToStore,
    });

    for (const item of input.items) {
      await this.inventoryService.recordInventoryEvent({
        productId: item.productId,
        warehouseId: warehouse.id,
        type: 'SALE_OUT',
        quantity: item.quantity,
        occurredAt: occurredAtStr,
        referenceId: order.id,
        note: `POS order ${orderNumber}`,
      });
    }

    const partyId = resolvedCustomerId;
    await this.financeService.recordFinanceEvent({
      type: 'SALE_RECEIVABLE',
      partyId,
      currency: 'TWD',
      amount: totalAmount,
      taxAmount: 0,
      occurredAt: occurredAtStr,
      referenceId: order.id,
      note: allowCredit
        ? `POS order ${orderNumber} (credit)`
        : `POS order ${orderNumber}`,
    });

    if (allowCredit) {
      for (const p of paymentsToStore) {
        await this.financeService.recordFinanceEvent({
          type: 'SALE_PAYMENT',
          partyId,
          currency: 'TWD',
          amount: p.amount,
          taxAmount: 0,
          occurredAt: occurredAtStr,
          referenceId: order.id,
          note: `POS ${orderNumber} ${p.method}`,
        });
      }
    }

    return this.toOrderDetail(order);
  }

  async appendPaymentToOrder(
    orderId: string,
    input: { method: string; amount: number; occurredAt?: string },
  ) {
    const order = await this.posRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'POS_ORDER_NOT_FOUND',
      });
    }
    if (
      typeof input.amount !== 'number' ||
      input.amount <= 0 ||
      Number.isNaN(input.amount)
    ) {
      throw new BadRequestException({
        message: 'amount must be a positive number',
        code: 'POS_PAYMENT_AMOUNT_INVALID',
      });
    }
    const method = input.method?.trim();
    if (!method) {
      throw new BadRequestException({
        message: 'method is required',
        code: 'POS_PAYMENT_AMOUNT_INVALID',
      });
    }

    const total = Number(order.totalAmount);
    const paid = (order.payments ?? []).reduce(
      (s, x) => s + Number(x.amount),
      0,
    );
    const remaining = Math.round((total - paid) * 100) / 100;
    if (remaining <= 0.01) {
      throw new BadRequestException({
        message: 'Order is already fully paid',
        code: 'POS_ORDER_ALREADY_SETTLED',
      });
    }
    if (input.amount - remaining > 0.01) {
      throw new BadRequestException({
        message: 'Payment amount exceeds remaining balance',
        code: 'POS_PAYMENT_EXCEEDS_REMAINING',
      });
    }

    const receivable = await this.prisma.financeEvent.findFirst({
      where: { referenceId: orderId, type: 'SALE_RECEIVABLE' },
    });
    if (!receivable) {
      throw new BadRequestException({
        message: 'No SALE_RECEIVABLE for this order; cannot append payment',
        code: 'POS_CREDIT_NO_RECEIVABLE',
      });
    }

    const updated = await this.posRepo.appendPayment(orderId, {
      method,
      amount: input.amount,
    });
    const occurredAtStr = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();
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
    return this.toOrderDetail(updated);
  }

  async refundToOrder(
    orderId: string,
    input: { amount: number; occurredAt?: string; note?: string },
  ) {
    const order = await this.posRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'POS_ORDER_NOT_FOUND',
      });
    }
    if (
      typeof input.amount !== 'number' ||
      input.amount <= 0 ||
      Number.isNaN(input.amount)
    ) {
      throw new BadRequestException({
        message: 'amount must be a positive number',
        code: 'POS_PAYMENT_AMOUNT_INVALID',
      });
    }

    const collected = (order.payments ?? []).reduce(
      (s, x) => s + Number(x.amount),
      0,
    );
    if (collected < 0.01) {
      throw new BadRequestException({
        message: 'No payment on order; cannot refund',
        code: 'POS_REFUND_NO_PAYMENT',
      });
    }

    const receivable = await this.prisma.financeEvent.findFirst({
      where: { referenceId: orderId, type: 'SALE_RECEIVABLE' },
    });
    if (!receivable) {
      throw new BadRequestException({
        message: 'No SALE_RECEIVABLE for this order; cannot refund',
        code: 'POS_CREDIT_NO_RECEIVABLE',
      });
    }

    const refundedAgg = await this.prisma.financeEvent.aggregate({
      where: { referenceId: orderId, type: 'SALE_REFUND' },
      _sum: { amount: true },
    });
    const alreadyRefunded = Number(refundedAgg._sum.amount ?? 0);
    const maxRefund = Math.round((collected - alreadyRefunded) * 100) / 100;
    if (input.amount - maxRefund > 0.01) {
      throw new BadRequestException({
        message: 'Refund amount exceeds refundable balance',
        code: 'POS_REFUND_EXCEEDS_PAID',
      });
    }

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
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'POS_ORDER_NOT_FOUND',
      });
    }
    const items = input.items ?? [];
    if (!items.length) {
      throw new BadRequestException({
        message: 'items must not be empty',
        code: 'POS_RETURN_ITEMS_EMPTY',
      });
    }

    const store = await this.prisma.store.findUnique({
      where: { id: order.storeId },
      include: { warehouses: true },
    });
    const warehouse = store?.warehouses[0];
    if (!warehouse) {
      throw new BadRequestException({
        message: 'Store has no warehouse',
        code: 'POS_STORE_NO_WAREHOUSE',
      });
    }

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
      if (!pid) {
        throw new BadRequestException({
          message: 'each item needs productId',
          code: 'POS_RETURN_PRODUCT_NOT_ON_ORDER',
        });
      }
      const q =
        typeof row.quantity === 'number' && row.quantity > 0
          ? Math.floor(row.quantity)
          : 0;
      if (q < 1) {
        throw new BadRequestException({
          message: 'each item quantity must be a positive integer',
          code: 'POS_RETURN_EXCEEDS_SOLD',
        });
      }
      const sold = soldByProduct.get(pid);
      if (sold == null || sold < 1) {
        throw new BadRequestException({
          message: `Product ${pid} not on this order`,
          code: 'POS_RETURN_PRODUCT_NOT_ON_ORDER',
        });
      }
      const already = alreadyByProduct.get(pid) ?? 0;
      if (already + q - sold > 0) {
        throw new BadRequestException({
          message: 'Return quantity exceeds sold less already returned',
          code: 'POS_RETURN_EXCEEDS_SOLD',
        });
      }
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

    const reloaded = await this.posRepo.findById(orderId);
    if (!reloaded) throw new Error('Order missing after return');
    return this.toOrderDetail(reloaded);
  }

  async getOrderById(id: string) {
    const order = await this.posRepo.findById(id);
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'POS_ORDER_NOT_FOUND',
      });
    }
    return this.toOrderDetail(order);
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
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({
        message: 'invalid from',
        code: 'POS_EXPORT_INVALID_RANGE',
      });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'invalid to',
        code: 'POS_EXPORT_INVALID_RANGE',
      });
    }
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
