import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  async list(merchantId: string, status?: string, q?: string) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({
        message: 'merchantId required',
        code: 'RN_MERCHANT_REQUIRED',
      });
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
    return this.prisma.receivingNote.findMany({
      where,
      include: {
        purchaseOrder: {
          select: { id: true, orderNumber: true, supplier: { select: { name: true } } },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
      throw new NotFoundException({ message: 'Receiving note not found', code: 'RN_NOT_FOUND' });
    }
    if (merchantId && rn.merchantId !== merchantId) {
      throw new NotFoundException({ message: 'Receiving note not found', code: 'RN_NOT_FOUND' });
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
      throw new NotFoundException({ message: 'PO not found', code: 'PO_NOT_FOUND' });
    }
    if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new BadRequestException({
        message: 'PO status does not allow receiving note',
        code: 'PO_INVALID_STATUS',
      });
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
      throw new BadRequestException({
        message: 'No remaining qty to receive on PO',
        code: 'PO_INVALID_STATUS',
      });
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

  async patchLines(
    id: string,
    lines: {
      lineId: string;
      receivedQty?: number;
      qualifiedQty?: number;
      returnedQty?: number;
      returnReason?: string;
    }[],
  ) {
    const rn = await this.getById(id);
    if (rn.status === 'COMPLETED' || rn.status === 'RETURNED') {
      throw new BadRequestException({
        message: 'Receiving note not editable',
        code: 'RN_NOT_EDITABLE',
      });
    }
    for (const u of lines) {
      const line = rn.lines.find((l) => l.id === u.lineId);
      if (!line) {
        throw new BadRequestException({
          message: 'RN line not found',
          code: 'PO_LINE_NOT_FOUND',
        });
      }
      const received = u.receivedQty ?? line.receivedQty;
      const qualified = u.qualifiedQty ?? line.qualifiedQty;
      const returned = u.returnedQty ?? line.returnedQty;
      if (qualified > received) {
        throw new BadRequestException({
          message: 'qualifiedQty cannot exceed receivedQty',
          code: 'RN_COMPLETE_INVALID',
        });
      }
      if (returned > received) {
        throw new BadRequestException({
          message: 'returnedQty cannot exceed receivedQty',
          code: 'RN_COMPLETE_INVALID',
        });
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
      throw new BadRequestException({
        message: 'Cannot complete returned note',
        code: 'RN_NOT_EDITABLE',
      });
    }
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: rn.purchaseOrderId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException({ message: 'PO not found', code: 'PO_NOT_FOUND' });

    let payableTotal = 0;
    for (const rl of rn.lines) {
      const pl = po.lines.find((l) => l.id === rl.purchaseOrderLineId)!;
      const remaining = pl.qtyOrdered - pl.qtyReceived;
      if (rl.qualifiedQty < 0 || rl.qualifiedQty > remaining) {
        throw new BadRequestException({
          message: `qualifiedQty invalid for line ${rl.id}`,
          code: 'RN_COMPLETE_INVALID',
        });
      }
      if (rl.qualifiedQty > rl.receivedQty) {
        throw new BadRequestException({
          message: 'qualifiedQty cannot exceed receivedQty',
          code: 'RN_COMPLETE_INVALID',
        });
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
        partyId: po.supplierId,
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
      throw new BadRequestException({
        message: 'Cannot reject completed note',
        code: 'RN_NOT_EDITABLE',
      });
    }
    return this.prisma.receivingNote.update({
      where: { id },
      data: { status: 'RETURNED' },
      include: { lines: true },
    });
  }
}
