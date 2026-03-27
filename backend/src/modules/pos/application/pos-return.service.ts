import { Injectable, Logger } from '@nestjs/common';
import {
  ReturnType as PrismaReturnType,
  ReturnReason,
  ItemCondition,
  RefundMethod,
} from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  throwBadRequest,
  throwNotFound,
} from '../../../shared/utils/throw-exceptions';
import { InventoryService } from '../../inventory/application/inventory.service';
import { FinanceService } from '../../finance/application/finance.service';
import { LoyaltyService } from '../../loyalty/application/loyalty.service';
import { PosReturnRepository } from '../infrastructure/pos-return.repository';
import { PosRepository } from '../infrastructure/pos.repository';

export interface ReturnItemInput {
  productId: string;
  quantity: number;
  reason: ReturnReason;
  condition: ItemCondition;
  note?: string | null;
}

export interface ExchangeItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface ExchangePaymentInput {
  method: string;
  amount: number;
}

export interface PreviewReturnInput {
  type: PrismaReturnType;
  items: ReturnItemInput[];
  refundMethod: RefundMethod;
  exchangeItems?: ExchangeItemInput[];
}

export interface ExecuteReturnInput extends PreviewReturnInput {
  exchangePayments?: ExchangePaymentInput[];
  note?: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNum(v: unknown): number {
  if (typeof v === 'object' && v != null && 'toNumber' in v)
    return (v as { toNumber: () => number }).toNumber();
  return Number(v ?? 0);
}

@Injectable()
export class PosReturnService {
  private readonly logger = new Logger(PosReturnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly returnRepo: PosReturnRepository,
    private readonly posRepo: PosRepository,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  private generateReturnNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    const rnd = Math.random().toString(36).slice(-4);
    return `RTN-${datePart}-${seq}-${rnd}`;
  }

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    const rnd = Math.random().toString(36).slice(-4);
    return `POS-${datePart}-${seq}-${rnd}`;
  }

  private calculateDiscountProration(
    orderSubtotal: number,
    orderDiscount: number,
    returnItems: Array<{ productId: string; quantity: number; unitPrice: number }>,
  ) {
    if (orderSubtotal <= 0) {
      return {
        returnSubtotal: 0,
        discountShare: 0,
        refundAmount: 0,
        itemBreakdown: [] as Array<{
          productId: string;
          itemSubtotal: number;
          itemDiscountShare: number;
          itemRefund: number;
        }>,
      };
    }

    const discountRate = orderDiscount / orderSubtotal;
    const breakdown = returnItems.map((item) => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemDiscountShare = round2(itemSubtotal * discountRate);
      const itemRefund = round2(itemSubtotal - itemDiscountShare);
      return {
        productId: item.productId,
        itemSubtotal,
        itemDiscountShare,
        itemRefund,
      };
    });

    const returnSubtotal = round2(
      breakdown.reduce((s, b) => s + b.itemSubtotal, 0),
    );
    const discountShare = round2(
      breakdown.reduce((s, b) => s + b.itemDiscountShare, 0),
    );
    const refundAmount = round2(returnSubtotal - discountShare);

    return { returnSubtotal, discountShare, refundAmount, itemBreakdown: breakdown };
  }

  private async calculatePointsAdjustment(
    orderId: string,
    customerId: string | null,
    refundAmount: number,
    orderTotal: number,
  ): Promise<{ pointsToDeduct: number; pointsToReturn: number }> {
    if (!customerId || orderTotal <= 0) {
      return { pointsToDeduct: 0, pointsToReturn: 0 };
    }

    const earnedLedger = await this.prisma.pointLedger.findFirst({
      where: { referenceId: orderId, type: 'EARNED', customerId },
    });
    const originalEarned = earnedLedger?.amount ?? 0;

    const burnedLedger = await this.prisma.pointLedger.findFirst({
      where: { referenceId: orderId, type: 'BURNED', customerId },
    });
    const originalBurned = Math.abs(burnedLedger?.amount ?? 0);

    const ratio = refundAmount / orderTotal;
    const pointsToDeduct = Math.floor(originalEarned * ratio);
    const pointsToReturn = Math.floor(originalBurned * ratio);

    return { pointsToDeduct, pointsToReturn };
  }

  private async checkReturnWindow(
    orderId: string,
    orderCreatedAt: Date,
    type: PrismaReturnType,
    storeId: string,
  ): Promise<{ eligible: boolean; expiryDate: Date | null }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { merchantId: true },
    });
    if (!store) return { eligible: true, expiryDate: null };

    const policy = await this.prisma.returnPolicy.findUnique({
      where: { merchantId: store.merchantId },
    });
    if (!policy) return { eligible: true, expiryDate: null };

    const windowDays =
      type === 'EXCHANGE' ? policy.exchangeWindowDays : policy.returnWindowDays;
    const expiryDate = new Date(orderCreatedAt);
    expiryDate.setDate(expiryDate.getDate() + windowDays);

    return { eligible: new Date() <= expiryDate, expiryDate };
  }

  private async validateReturnItems(
    order: {
      id: string;
      items: Array<{ productId: string; quantity: number; unitPrice: unknown }>;
    },
    inputItems: ReturnItemInput[],
  ) {
    const soldByProduct = new Map<string, { qty: number; unitPrice: number }>();
    for (const line of order.items) {
      const existing = soldByProduct.get(line.productId);
      soldByProduct.set(line.productId, {
        qty: (existing?.qty ?? 0) + line.quantity,
        unitPrice: toNum(line.unitPrice),
      });
    }

    const returnedAgg = await this.prisma.inventoryEvent.findMany({
      where: { referenceId: order.id, type: 'RETURN_FROM_CUSTOMER' },
      select: { productId: true, quantity: true },
    });
    const alreadyByProduct = new Map<string, number>();
    for (const ev of returnedAgg) {
      alreadyByProduct.set(
        ev.productId,
        (alreadyByProduct.get(ev.productId) ?? 0) + ev.quantity,
      );
    }

    const existingReturns = await this.prisma.posReturn.findMany({
      where: { orderId: order.id, status: 'COMPLETED' },
      include: { items: true },
    });
    const returnedViaPosReturn = new Map<string, number>();
    for (const ret of existingReturns) {
      for (const item of ret.items) {
        returnedViaPosReturn.set(
          item.productId,
          (returnedViaPosReturn.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    const validated: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      reason: ReturnReason;
      condition: ItemCondition;
      note?: string | null;
    }> = [];

    for (const row of inputItems) {
      const pid = row.productId?.trim();
      if (!pid)
        throwBadRequest(
          'POS_RETURN_PRODUCT_NOT_ON_ORDER',
          'each item needs productId',
        );

      const sold = soldByProduct.get(pid);
      if (!sold)
        throwBadRequest(
          'POS_RETURN_PRODUCT_NOT_ON_ORDER',
          `Product ${pid} not on this order`,
        );

      const q = Math.floor(row.quantity);
      if (q < 1)
        throwBadRequest(
          'POS_RETURN_EXCEEDS_SOLD',
          'each item quantity must be a positive integer',
        );

      const alreadyReturned = returnedViaPosReturn.get(pid) ?? 0;
      if (alreadyReturned + q > sold.qty)
        throwBadRequest(
          'POS_RETURN_EXCEEDS_SOLD',
          `Return quantity for ${pid} exceeds sold minus already returned`,
        );

      validated.push({
        productId: pid,
        quantity: q,
        unitPrice: sold.unitPrice,
        reason: row.reason,
        condition: row.condition,
        note: row.note,
      });
    }

    return validated;
  }

  async previewReturn(orderId: string, input: PreviewReturnInput) {
    const order = await this.posRepo.findById(orderId);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');

    if (!input.items?.length)
      throwBadRequest('POS_RETURN_ITEMS_EMPTY', 'items must not be empty');

    const validatedItems = await this.validateReturnItems(order, input.items);
    const orderSubtotal = toNum(order.subtotalAmount);
    const orderDiscount = toNum(order.discountAmount);
    const orderTotal = toNum(order.totalAmount);

    const { eligible, expiryDate } = await this.checkReturnWindow(
      order.id,
      order.createdAt,
      input.type,
      order.storeId,
    );

    const proration = this.calculateDiscountProration(
      orderSubtotal,
      orderDiscount,
      validatedItems,
    );

    const points = await this.calculatePointsAdjustment(
      order.id,
      order.customerId ?? null,
      proration.refundAmount,
      orderTotal,
    );

    let exchangeTotal = 0;
    if (input.type === 'EXCHANGE' && input.exchangeItems?.length) {
      exchangeTotal = round2(
        input.exchangeItems.reduce(
          (s, i) => s + i.unitPrice * i.quantity,
          0,
        ),
      );
    }

    const deltaAmount = round2(exchangeTotal - proration.refundAmount);

    return {
      eligible,
      returnWindowExpiry: expiryDate?.toISOString() ?? null,
      returnSubtotal: proration.returnSubtotal,
      discountShare: proration.discountShare,
      refundAmount: proration.refundAmount,
      pointsToDeduct: points.pointsToDeduct,
      pointsToReturn: points.pointsToReturn,
      exchangeTotal,
      deltaAmount,
      items: proration.itemBreakdown.map((b) => ({
        productId: b.productId,
        quantity:
          validatedItems.find((v) => v.productId === b.productId)?.quantity ?? 0,
        unitPrice:
          validatedItems.find((v) => v.productId === b.productId)?.unitPrice ?? 0,
        itemDiscountShare: b.itemDiscountShare,
        itemRefund: b.itemRefund,
      })),
    };
  }

  async executeReturn(orderId: string, input: ExecuteReturnInput) {
    const order = await this.posRepo.findById(orderId);
    if (!order) throwNotFound('POS_ORDER_NOT_FOUND', 'Order not found');

    if (!input.items?.length)
      throwBadRequest('POS_RETURN_ITEMS_EMPTY', 'items must not be empty');

    const validatedItems = await this.validateReturnItems(order, input.items);
    const orderSubtotal = toNum(order.subtotalAmount);
    const orderDiscount = toNum(order.discountAmount);
    const orderTotal = toNum(order.totalAmount);

    const { eligible } = await this.checkReturnWindow(
      order.id,
      order.createdAt,
      input.type,
      order.storeId,
    );
    if (!eligible)
      throwBadRequest(
        'POS_RETURN_WINDOW_EXPIRED',
        'Return window has expired for this order',
      );

    const proration = this.calculateDiscountProration(
      orderSubtotal,
      orderDiscount,
      validatedItems,
    );

    const points = await this.calculatePointsAdjustment(
      order.id,
      order.customerId ?? null,
      proration.refundAmount,
      orderTotal,
    );

    const store = await this.prisma.store.findUnique({
      where: { id: order.storeId },
      include: { warehouses: true },
    });
    const warehouse = store?.warehouses[0];
    if (!warehouse)
      throwBadRequest('POS_STORE_NO_WAREHOUSE', 'Store has no warehouse');

    const occurredAtStr = new Date().toISOString();
    const partyId = order.customerId
      ? `customer:${order.customerId}`
      : '';
    const returnNumber = this.generateReturnNumber();

    let exchangeTotal = 0;
    let deltaAmount = 0;
    if (input.type === 'EXCHANGE' && input.exchangeItems?.length) {
      exchangeTotal = round2(
        input.exchangeItems.reduce(
          (s, i) => s + i.unitPrice * i.quantity,
          0,
        ),
      );
      deltaAmount = round2(exchangeTotal - proration.refundAmount);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const posReturn = await this.returnRepo.create({
        returnNumber,
        orderId: order.id,
        storeId: order.storeId,
        customerId: order.customerId ?? null,
        type: input.type,
        returnSubtotal: proration.returnSubtotal,
        discountShare: proration.discountShare,
        refundAmount: proration.refundAmount,
        refundMethod: input.refundMethod,
        pointsDeducted: points.pointsToDeduct,
        pointsReturned: points.pointsToReturn,
        note: input.note ?? null,
        items: validatedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          reason: item.reason,
          condition: item.condition,
          note: item.note,
        })),
      }, tx);

      for (const item of validatedItems) {
        await this.inventoryService.recordInventoryEvent({
          productId: item.productId,
          warehouseId: warehouse.id,
          type: 'RETURN_FROM_CUSTOMER',
          quantity: item.quantity,
          occurredAt: occurredAtStr,
          referenceId: posReturn.id,
          note: `RTN ${returnNumber} ${item.condition === 'GOOD' ? 'return-to-stock' : 'return-then-scrap'}`,
        });

        if (item.condition !== 'GOOD') {
          await this.inventoryService.recordInventoryEvent({
            productId: item.productId,
            warehouseId: warehouse.id,
            type: 'SCRAP_LOSS',
            quantity: item.quantity,
            occurredAt: occurredAtStr,
            referenceId: posReturn.id,
            note: `RTN ${returnNumber} defective scrap`,
            skipReferenceIdCheck: true,
          });
        }
      }

      if (input.refundMethod === 'CASH' && proration.refundAmount > 0) {
        if (input.type !== 'EXCHANGE') {
          await this.financeService.recordFinanceEvent({
            type: 'SALE_REFUND',
            partyId: partyId || null,
            currency: 'TWD',
            amount: proration.refundAmount,
            taxAmount: 0,
            occurredAt: occurredAtStr,
            referenceId: order.id,
            note: `RTN ${returnNumber} refund`,
          });
        }
      } else if (
        input.refundMethod === 'STORE_CREDIT' &&
        proration.refundAmount > 0 &&
        order.customerId
      ) {
        if (input.type !== 'EXCHANGE') {
          const prevCredit = await tx.storeCreditLedger.findFirst({
            where: { customerId: order.customerId },
            orderBy: { createdAt: 'desc' },
          });
          const prevBalance = toNum(prevCredit?.balanceAfter);
          await tx.storeCreditLedger.create({
            data: {
              merchantId: store!.merchantId,
              customerId: order.customerId,
              amount: proration.refundAmount,
              balanceAfter: round2(prevBalance + proration.refundAmount),
              referenceId: posReturn.id,
              note: `RTN ${returnNumber} store credit`,
            },
          });
        }
      }

      if (points.pointsToDeduct > 0 && order.customerId) {
        await this.loyaltyService.appendLedger({
          merchantId: store!.merchantId,
          customerId: order.customerId,
          type: 'BURNED',
          amount: -points.pointsToDeduct,
          txnCode: 'RETURN',
          referenceId: posReturn.id,
          note: `RTN ${returnNumber} 扣回贈點`,
        });
      }

      if (points.pointsToReturn > 0 && order.customerId) {
        await this.loyaltyService.appendLedger({
          merchantId: store!.merchantId,
          customerId: order.customerId,
          type: 'EARNED',
          amount: points.pointsToReturn,
          txnCode: 'RETURN',
          referenceId: posReturn.id,
          note: `RTN ${returnNumber} 退還折抵點數`,
        });
      }

      let exchangeOrder: {
        id: string;
        orderNumber: string;
        totalAmount: number;
      } | null = null;

      if (input.type === 'EXCHANGE' && input.exchangeItems?.length) {
        const exchangeOrderNumber = this.generateOrderNumber();
        const exchangePayments = input.exchangePayments ?? [];

        const created = await this.posRepo.createOrder({
          orderNumber: exchangeOrderNumber,
          storeId: order.storeId,
          customerId: order.customerId ?? null,
          exchangeFromOrderId: order.id,
          subtotalAmount: exchangeTotal,
          discountAmount: 0,
          totalAmount: exchangeTotal,
          items: input.exchangeItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          payments: deltaAmount > 0
            ? exchangePayments.map((p) => ({
                method: p.method,
                amount: p.amount,
              }))
            : [],
        });

        for (const item of input.exchangeItems) {
          await this.inventoryService.recordInventoryEvent({
            productId: item.productId,
            warehouseId: warehouse.id,
            type: 'SALE_OUT',
            quantity: item.quantity,
            occurredAt: occurredAtStr,
            referenceId: created.id,
            note: `POS ${exchangeOrderNumber} exchange`,
          });
        }

        await this.financeService.recordFinanceEvent({
          type: 'SALE_RECEIVABLE',
          partyId: partyId || null,
          currency: 'TWD',
          amount: exchangeTotal,
          taxAmount: 0,
          occurredAt: occurredAtStr,
          referenceId: created.id,
          note: `POS ${exchangeOrderNumber} exchange order`,
        });

        if (deltaAmount > 0) {
          for (const p of exchangePayments) {
            await this.financeService.recordFinanceEvent({
              type: 'SALE_PAYMENT',
              partyId: partyId || null,
              currency: 'TWD',
              amount: p.amount,
              taxAmount: 0,
              occurredAt: occurredAtStr,
              referenceId: created.id,
              note: `POS ${exchangeOrderNumber} exchange topup ${p.method}`,
            });
          }
        } else if (deltaAmount < 0) {
          await this.financeService.recordFinanceEvent({
            type: 'SALE_REFUND',
            partyId: partyId || null,
            currency: 'TWD',
            amount: Math.abs(deltaAmount),
            taxAmount: 0,
            occurredAt: occurredAtStr,
            referenceId: order.id,
            note: `RTN ${returnNumber} exchange refund difference`,
          });
        }

        await this.returnRepo.updateExchangeOrderId(posReturn.id, created.id, tx);

        exchangeOrder = {
          id: created.id,
          orderNumber: exchangeOrderNumber,
          totalAmount: exchangeTotal,
        };
      }

      return { posReturn, exchangeOrder };
    });

    this.logger.log(
      `executeReturn ${returnNumber} order=${order.orderNumber} type=${input.type} refund=${proration.refundAmount}`,
    );

    return this.formatReturnResponse(result.posReturn, result.exchangeOrder, deltaAmount);
  }

  async listReturns(filter: {
    storeId?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 50));
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;

    let type: PrismaReturnType | undefined;
    if (filter.type) {
      const valid: PrismaReturnType[] = ['FULL_RETURN', 'PARTIAL_RETURN', 'EXCHANGE'];
      if (valid.includes(filter.type as PrismaReturnType)) {
        type = filter.type as PrismaReturnType;
      }
    }

    const { items, total } = await this.returnRepo.findMany({
      storeId: filter.storeId?.trim(),
      type,
      from,
      to,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        orderId: r.orderId,
        orderNumber: r.order?.orderNumber ?? null,
        type: r.type,
        status: r.status,
        refundAmount: toNum(r.refundAmount),
        refundMethod: r.refundMethod,
        createdAt: r.createdAt.toISOString(),
        itemCount: r.items.length,
        topReason: r.items[0]?.reason ?? null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getReturnById(id: string) {
    const r = await this.returnRepo.findById(id);
    if (!r) throwNotFound('POS_RETURN_NOT_FOUND', 'Return not found');
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      storeId: r.storeId,
      customerId: r.customerId,
      type: r.type,
      status: r.status,
      returnSubtotal: toNum(r.returnSubtotal),
      discountShare: toNum(r.discountShare),
      refundAmount: toNum(r.refundAmount),
      refundMethod: r.refundMethod,
      pointsDeducted: r.pointsDeducted,
      pointsReturned: r.pointsReturned,
      exchangeOrderId: r.exchangeOrderId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: toNum(i.unitPrice),
        reason: i.reason,
        condition: i.condition,
        note: i.note,
      })),
    };
  }

  private formatReturnResponse(
    posReturn: {
      id: string;
      returnNumber: string;
      orderId: string;
      type: PrismaReturnType;
      status: string;
      returnSubtotal: unknown;
      discountShare: unknown;
      refundAmount: unknown;
      refundMethod: RefundMethod;
      pointsDeducted: number;
      pointsReturned: number;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        unitPrice: unknown;
        reason: ReturnReason;
        condition: ItemCondition;
        note: string | null;
      }>;
    },
    exchangeOrder: { id: string; orderNumber: string; totalAmount: number } | null,
    deltaAmount: number,
  ) {
    return {
      id: posReturn.id,
      returnNumber: posReturn.returnNumber,
      orderId: posReturn.orderId,
      type: posReturn.type,
      status: posReturn.status,
      returnSubtotal: toNum(posReturn.returnSubtotal),
      discountShare: toNum(posReturn.discountShare),
      refundAmount: toNum(posReturn.refundAmount),
      refundMethod: posReturn.refundMethod,
      pointsDeducted: posReturn.pointsDeducted,
      pointsReturned: posReturn.pointsReturned,
      items: posReturn.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: toNum(i.unitPrice),
        reason: i.reason,
        condition: i.condition,
        note: i.note,
      })),
      exchangeOrder,
      settlement: exchangeOrder
        ? {
            deltaAmount,
            customerPays: deltaAmount > 0 ? deltaAmount : 0,
            customerReceives: deltaAmount < 0 ? Math.abs(deltaAmount) : 0,
          }
        : null,
      createdAt: posReturn.createdAt.toISOString(),
    };
  }
}
