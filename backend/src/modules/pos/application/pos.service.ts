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
  /** 為 true 時允許實收 &lt; 應收（賒帳）；須帶 customerId；金流寫入 SALE_RECEIVABLE + SALE_PAYMENT */
  allowCredit?: boolean;
}

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posRepo: PosRepository,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
  ) {}

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    return `POS-${datePart}-${seq}`;
  }

  async createOrder(input: CreatePosOrderInput) {
    if (!input.items?.length) {
      throw new BadRequestException({
        message: 'items must not be empty',
        code: 'POS_ITEMS_EMPTY',
      });
    }

    const allowCredit = Boolean(input.allowCredit);

    if (allowCredit) {
      const cid = input.customerId?.trim();
      if (!cid) {
        throw new BadRequestException({
          message: 'customerId is required when allowCredit is true',
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

    const warehouse = store.warehouses[0];
    if (!warehouse) {
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

    const totalAmount = input.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0,
    );
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

    for (const item of input.items) {
      const balance = await this.prisma.inventoryBalance.findUnique({
        where: {
          productId_warehouseId: {
            productId: item.productId,
            warehouseId: warehouse.id,
          },
        },
      });
      const onHand = balance?.onHandQty ?? 0;
      if (onHand < item.quantity) {
        throw new ConflictException({
          message: `Insufficient inventory for product ${item.productId}: required ${item.quantity}, on hand ${onHand}`,
          code: 'INVENTORY_INSUFFICIENT',
        });
      }
    }

    const orderNumber = this.generateOrderNumber();
    const order = await this.posRepo.createOrder({
      orderNumber,
      storeId: input.storeId,
      totalAmount,
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

    const partyId = input.customerId ?? null;
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
      })),
      page,
      pageSize,
      total,
    };
  }

  private toOrderDetail(order: {
    id: string;
    orderNumber: string;
    storeId: string;
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
    const total =
      typeof order.totalAmount === 'object' && 'toNumber' in order.totalAmount
        ? (order.totalAmount as { toNumber: () => number }).toNumber()
        : Number(order.totalAmount);
    const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
    const remainingAmount = Math.round((total - paidAmount) * 100) / 100;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
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
