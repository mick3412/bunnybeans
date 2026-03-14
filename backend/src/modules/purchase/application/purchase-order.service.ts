import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string, status?: string, q?: string) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({
        message: 'merchantId required',
        code: 'PO_MERCHANT_REQUIRED',
      });
    }
    const where: Prisma.PurchaseOrderWhereInput = { merchantId: m };
    if (status?.trim()) {
      where.status = status as PurchaseOrderStatus;
    }
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { supplier: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        /** 列表需品項數／金額；與前端 poTotal、lines.length 對齊 */
        lines: {
          select: {
            id: true,
            productId: true,
            qtyOrdered: true,
            unitCost: true,
            qtyReceived: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, merchantId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
        supplier: true,
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
    if (!po) {
      throw new NotFoundException({ message: 'PO not found', code: 'PO_NOT_FOUND' });
    }
    if (merchantId && po.merchantId !== merchantId) {
      throw new NotFoundException({ message: 'PO not found', code: 'PO_NOT_FOUND' });
    }
    return po;
  }

  async create(data: {
    merchantId: string;
    supplierId: string;
    warehouseId: string;
    orderNumber: string;
    expectedDate?: string;
    lines: { productId: string; qtyOrdered: number; unitCost: number }[];
  }) {
    if (!data.lines?.length) {
      throw new BadRequestException({
        message: 'At least one line required',
        code: 'PO_LINES_REQUIRED',
      });
    }
    try {
      return await this.prisma.purchaseOrder.create({
        data: {
          merchantId: data.merchantId.trim(),
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          orderNumber: data.orderNumber.trim(),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          status: 'DRAFT',
          lines: {
            create: data.lines.map((l) => ({
              productId: l.productId,
              qtyOrdered: l.qtyOrdered,
              unitCost: l.unitCost,
            })),
          },
        },
        include: { lines: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'orderNumber already exists',
          code: 'PO_ORDER_NUMBER_CONFLICT',
        });
      }
      throw e;
    }
  }

  async patchDraft(
    id: string,
    data: {
      expectedDate?: string | null;
      lines?: { productId: string; qtyOrdered: number; unitCost: number }[];
    },
  ) {
    const po = await this.getById(id);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException({
        message: 'Only DRAFT can be patched',
        code: 'PO_NOT_DRAFT',
      });
    }
    if (data.lines?.length) {
      await this.prisma.purchaseOrderLine.deleteMany({ where: { poId: id } });
      await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          expectedDate:
            data.expectedDate === undefined
              ? undefined
              : data.expectedDate
                ? new Date(data.expectedDate)
                : null,
          lines: {
            create: data.lines.map((l) => ({
              productId: l.productId,
              qtyOrdered: l.qtyOrdered,
              unitCost: l.unitCost,
            })),
          },
        },
        include: { lines: true },
      });
    } else {
      await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          expectedDate:
            data.expectedDate === undefined
              ? undefined
              : data.expectedDate
                ? new Date(data.expectedDate)
                : null,
        },
        include: { lines: true },
      });
    }
    return this.getById(id);
  }

  async submit(id: string) {
    const po = await this.getById(id);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException({
        message: 'Only DRAFT can submit',
        code: 'PO_INVALID_STATUS',
      });
    }
    if (!po.lines.length) {
      throw new BadRequestException({
        message: 'PO has no lines',
        code: 'PO_LINES_REQUIRED',
      });
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ORDERED', orderDate: new Date() },
      include: { lines: true, supplier: true, warehouse: true },
    });
  }

  async cancel(id: string) {
    const po = await this.getById(id);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException({
        message: 'Only DRAFT can cancel',
        code: 'PO_INVALID_STATUS',
      });
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { lines: true },
    });
  }
}
