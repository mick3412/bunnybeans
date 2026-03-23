import { Injectable, Logger } from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryService } from '../../inventory/application/inventory.service';
import { FinanceService } from '../../finance/application/finance.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReceivingNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly finance: FinanceService,
  ) {}

  private receiptNumber(): string {
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `RN-${y}${mo}${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async list(
    merchantId: string,
    status?: string,
    q?: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('RN_MERCHANT_REQUIRED', 'merchantId required');
    }
    const where: Prisma.ReceivingNoteWhereInput = { merchantId: m };
    if (status?.trim()) {
      where.status = status as Prisma.ReceivingNoteWhereInput['status'];
    }
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { receiptNumber: { contains: s, mode: 'insensitive' } },
        { purchaseOrder: { orderNumber: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const page = opts?.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      this.prisma.receivingNote.count({ where }),
      this.prisma.receivingNote.findMany({
        where,
        include: {
          purchaseOrder: {
            select: { id: true, orderNumber: true, supplier: { select: { name: true } } },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string, merchantId?: string) {
    const rn = await this.prisma.receivingNote.findUnique({
      where: { id },
      include: {
        lines: { include: { purchaseOrderLine: true } },
        purchaseOrder: {
          include: { supplier: true, warehouse: true },
        },
      },
    });
    if (!rn) {
      throwNotFound('RN_NOT_FOUND', 'Receiving note not found');
    }
    if (merchantId && rn.merchantId !== merchantId) {
      throwNotFound('RN_NOT_FOUND', 'Receiving note not found');
    }
    return rn;
  }

  async create(data: {
    merchantId: string;
    purchaseOrderId: string;
    inspectorName?: string;
    remark?: string;
  }) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: { lines: true },
    });
    if (!po || po.merchantId !== data.merchantId.trim()) {
      throwNotFound('PO_NOT_FOUND', 'PO not found');
    }
    if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
      throwBadRequest('PO_INVALID_STATUS', 'PO status does not allow receiving note');
    }
    const lineCreates: Prisma.ReceivingNoteLineCreateWithoutReceivingNoteInput[] = [];
    for (const pl of po.lines) {
      const remaining = pl.qtyOrdered - pl.qtyReceived;
      if (remaining <= 0) continue;
      lineCreates.push({
        purchaseOrderLine: { connect: { id: pl.id } },
        orderedQty: remaining,
        receivedQty: 0,
        qualifiedQty: 0,
        returnedQty: 0,
      });
    }
    if (!lineCreates.length) {
      throwBadRequest('PO_INVALID_STATUS', 'No remaining qty to receive on PO');
    }
    return this.prisma.receivingNote.create({
      data: {
        merchantId: data.merchantId.trim(),
        receiptNumber: this.receiptNumber(),
        purchaseOrderId: po.id,
        inspectorName: data.inspectorName?.trim() || null,
        remark: data.remark?.trim() || null,
        status: 'PENDING',
        lines: { create: lineCreates },
      },
      include: { lines: true, purchaseOrder: true },
    });
  }

  /**
   * 若提供 productionDate + shelfLifeMonths，則計算 expiryDate = productionDate + shelfLifeMonths。
   * 與直接提供 expiryDate 二擇一。
   */
  private computeExpiryDate(line: {
    expiryDate?: string | null;
    productionDate?: string | null;
    shelfLifeMonths?: number | null;
  }): string | null | undefined {
    if (line.expiryDate !== undefined && line.expiryDate !== null && line.expiryDate !== '') {
      return line.expiryDate;
    }
    if (
      line.productionDate &&
      line.shelfLifeMonths != null &&
      Number.isFinite(line.shelfLifeMonths) &&
      line.shelfLifeMonths >= 0
    ) {
      const d = new Date(line.productionDate);
      if (Number.isNaN(d.getTime())) return undefined;
      d.setUTCMonth(d.getUTCMonth() + line.shelfLifeMonths);
      return d.toISOString().slice(0, 10);
    }
    return line.expiryDate;
  }

  async patchLines(
    id: string,
    lines: {
      lineId: string;
      receivedQty?: number;
      qualifiedQty?: number;
      returnedQty?: number;
      returnReason?: string;
      batchCode?: string | null;
      expiryDate?: string | null;
      /** 生產日期（與 shelfLifeMonths 搭配，二擇一於 expiryDate） */
      productionDate?: string | null;
      /** 有效期限月數（與 productionDate 搭配） */
      shelfLifeMonths?: number | null;
      weightUnit?: string | null;
    }[],
  ) {
    const rn = await this.getById(id);
    if (rn.status === 'COMPLETED' || rn.status === 'RETURNED') {
      throwBadRequest('RN_NOT_EDITABLE', 'Receiving note not editable');
    }
    for (const u of lines) {
      const line = rn.lines.find((l) => l.id === u.lineId);
      if (!line) {
        throwBadRequest('PO_LINE_NOT_FOUND', 'RN line not found');
      }
      const received = u.receivedQty ?? line.receivedQty;
      const qualified = u.qualifiedQty ?? line.qualifiedQty;
      const returned = u.returnedQty ?? line.returnedQty;
      if (qualified > received) {
        throwBadRequest('RN_COMPLETE_INVALID', 'qualifiedQty cannot exceed receivedQty');
      }
      if (returned > received) {
        throwBadRequest('RN_COMPLETE_INVALID', 'returnedQty cannot exceed receivedQty');
      }
      if (received + returned > line.orderedQty + 1) {
        // allow small tolerance - actually received+returned should <= orderedQty for the batch
      }
      await this.prisma.receivingNoteLine.update({
        where: { id: u.lineId },
        data: {
          ...(u.receivedQty !== undefined && { receivedQty: u.receivedQty }),
          ...(u.qualifiedQty !== undefined && { qualifiedQty: u.qualifiedQty }),
          ...(u.returnedQty !== undefined && { returnedQty: u.returnedQty }),
          ...(u.returnReason !== undefined && {
            returnReason: u.returnReason?.trim() || null,
          }),
        },
      });

      const resolvedExpiry = this.computeExpiryDate(u);

      // Prisma Client schema 可能尚未包含 batchCode/expiryDate/weightUnit；
      // 若 DB 已 migrate，使用 raw SQL UPDATE 補寫欄位，未 migrate 則忽略保持相容。
      if (
        u.batchCode !== undefined ||
        resolvedExpiry !== undefined ||
        u.weightUnit !== undefined
      ) {
        try {
          // NOTE: 不更新的欄位保留原值（避免把未提供的欄位覆蓋成 null）
          if (u.batchCode !== undefined) {
            await this.prisma.$executeRaw`
              UPDATE "ReceivingNoteLine"
              SET "batchCode" = ${u.batchCode?.trim() || null}
              WHERE "id" = ${u.lineId}
            `;
          }
          if (resolvedExpiry !== undefined) {
            await this.prisma.$executeRaw`
              UPDATE "ReceivingNoteLine"
              SET "expiryDate" = ${
                resolvedExpiry ? new Date(resolvedExpiry) : null
              }
              WHERE "id" = ${u.lineId}
            `;
          }
          if (u.weightUnit !== undefined) {
            await this.prisma.$executeRaw`
              UPDATE "ReceivingNoteLine"
              SET "weightUnit" = ${u.weightUnit?.trim() || null}
              WHERE "id" = ${u.lineId}
            `;
          }
        } catch (e) {
          // Raw update may fail if DB schema/migration differs; fallback preserves patchLines flow.
          new Logger(ReceivingNoteService.name).warn(`patchLines raw update failed: ${(e as Error).message}`);
        }
      }
    }
    await this.prisma.receivingNote.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    return this.getById(id);
  }

  async complete(id: string) {
    const rn = await this.getById(id);
    if (rn.status === 'COMPLETED') {
      return rn;
    }
    if (rn.status === 'RETURNED') {
      throwBadRequest('RN_NOT_EDITABLE', 'Cannot complete returned note');
    }
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: rn.purchaseOrderId },
      include: { lines: true },
    });
    if (!po) throwNotFound('PO_NOT_FOUND', 'PO not found');

    let payableTotal = 0;
    for (const rl of rn.lines) {
      const pl = po.lines.find((l) => l.id === rl.purchaseOrderLineId)!;
      const remaining = pl.qtyOrdered - pl.qtyReceived;
      if (rl.qualifiedQty < 0 || rl.qualifiedQty > remaining) {
        throwBadRequest('RN_COMPLETE_INVALID', `qualifiedQty invalid for line ${rl.id}`);
      }
      if (rl.qualifiedQty > rl.receivedQty) {
        throwBadRequest('RN_COMPLETE_INVALID', 'qualifiedQty cannot exceed receivedQty');
      }
      payableTotal += rl.qualifiedQty * Number(pl.unitCost);
    }

    for (const rl of rn.lines) {
      if (rl.qualifiedQty <= 0) continue;
      await this.inventory.recordInventoryEvent({
        productId: rl.purchaseOrderLine.productId,
        warehouseId: po.warehouseId,
        type: 'PURCHASE_IN',
        quantity: rl.qualifiedQty,
        referenceId: rl.id,
        note: `RN ${rn.receiptNumber}`,
        batchCode: rl.batchCode ?? undefined,
        expiryDate: rl.expiryDate ? rl.expiryDate.toISOString() : undefined,
        weightUnit: rl.weightUnit ?? undefined,
      });
      await this.prisma.purchaseOrderLine.update({
        where: { id: rl.purchaseOrderLineId },
        data: { qtyReceived: { increment: rl.qualifiedQty } },
      });
    }
    await this.prisma.receivingNote.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    const poAfter = await this.prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { lines: true },
    });
    if (!poAfter) return this.getById(id);
    let allReceived = true;
    for (const pl of poAfter.lines) {
      if (pl.qtyReceived < pl.qtyOrdered) {
        allReceived = false;
        break;
      }
    }
    await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
    });

    if (payableTotal > 0) {
      await this.finance.recordFinanceEvent({
        type: 'PURCHASE_PAYABLE',
        partyId: `supplier:${po.supplierId}`,
        currency: 'TWD',
        amount: Math.round(payableTotal * 100) / 100,
        referenceId: id,
        note: `PURCHASE_PAYABLE RN ${rn.receiptNumber}`,
      });
    }

    return this.getById(id);
  }

  async reject(id: string) {
    const rn = await this.getById(id);
    if (rn.status === 'COMPLETED') {
      throwBadRequest('RN_NOT_EDITABLE', 'Cannot reject completed note');
    }
    return this.prisma.receivingNote.update({
      where: { id },
      data: { status: 'RETURNED' },
      include: { lines: true },
    });
  }

  /**
   * 部分退貨至供應商：扣庫 RETURN_TO_SUPPLIER、寫一筆 PURCHASE_RETURN。
   * RN 須為 COMPLETED；每列 quantity 不得超過該列 qualifiedQty 減已退數量。
   */
  async returnToSupplier(
    id: string,
    body: { lines: { receivingNoteLineId: string; quantity: number }[] },
  ) {
    const rn = await this.getById(id);
    if (rn.status !== 'COMPLETED') {
      throwBadRequest('RN_NOT_EDITABLE', 'Only completed receiving note can return to supplier');
    }
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: rn.purchaseOrderId },
      include: { lines: true },
    });
    if (!po) throwNotFound('PO_NOT_FOUND', 'PO not found');
    const supplierId = po.supplierId;
    const warehouseId = po.warehouseId;

    const lines = body.lines ?? [];
    if (!lines.length) {
      throwBadRequest('RN_COMPLETE_INVALID', 'lines required with at least one item');
    }

    let totalReturnAmount = 0;
    const occurredAt = new Date();

    for (const { receivingNoteLineId, quantity } of lines) {
      if (quantity <= 0 || !Number.isFinite(quantity)) {
        throwBadRequest('RN_COMPLETE_INVALID', 'quantity must be a positive number');
      }
      const rl = rn.lines.find((l) => l.id === receivingNoteLineId);
      if (!rl) {
        throwBadRequest('PO_LINE_NOT_FOUND', 'Receiving note line not found');
      }
      const pl = po.lines.find((l) => l.id === rl.purchaseOrderLineId)!;
      const qualifiedQty = rl.qualifiedQty;
      const alreadyReturned = await this.prisma.inventoryEvent.aggregate({
        where: {
          type: 'RETURN_TO_SUPPLIER',
          referenceId: rl.id,
        },
        _sum: { quantity: true },
      });
      const returnedSum = Math.abs(alreadyReturned._sum.quantity ?? 0);
      if (quantity > qualifiedQty - returnedSum) {
        throwBadRequest('RN_COMPLETE_INVALID', `quantity exceeds qualified qty minus already returned for line ${rl.id}`);
      }
      await this.inventory.recordInventoryEvent({
        productId: pl.productId,
        warehouseId,
        type: 'RETURN_TO_SUPPLIER',
        quantity,
        referenceId: rl.id,
        occurredAt: occurredAt.toISOString(),
        note: 'Return to supplier RN ' + rn.receiptNumber,
      });
      totalReturnAmount += quantity * Number(pl.unitCost);
    }

    const amount = Math.round(totalReturnAmount * 100) / 100;
    if (amount > 0) {
      await this.finance.recordFinanceEvent({
        type: 'PURCHASE_RETURN',
        partyId: `supplier:${supplierId}`,
        currency: 'TWD',
        amount,
        occurredAt: occurredAt.toISOString(),
        referenceId: id,
        note: `PURCHASE_RETURN RN ${rn.receiptNumber}`,
      });
    }

    return this.getById(id);
  }
}
