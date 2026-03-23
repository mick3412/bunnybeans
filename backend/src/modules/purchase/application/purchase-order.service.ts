import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { ReceivingNoteService } from './receiving-note.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receivingNotes: ReceivingNoteService,
  ) {}

  async list(
    merchantId: string,
    status?: string,
    q?: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('PO_MERCHANT_REQUIRED', 'merchantId required');
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
    const page = opts?.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
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
        skip,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
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
      throwNotFound('PO_NOT_FOUND', 'PO not found');
    }
    if (merchantId && po.merchantId !== merchantId) {
      throwNotFound('PO_NOT_FOUND', 'PO not found');
    }
    const lines = po.lines as Array<{ qtyOrdered: number; qtyReceived: number }>;
    const totalOrdered = lines.reduce((s, l) => s + Number(l.qtyOrdered ?? 0), 0);
    const totalReceived = lines.reduce((s, l) => s + Number(l.qtyReceived ?? 0), 0);
    const percentComplete =
      totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 1000) / 10 : 100;
    const fullyReceivedLinesCount = lines.filter(
      (l) => Number(l.qtyReceived ?? 0) >= Number(l.qtyOrdered ?? 0),
    ).length;
    return {
      ...po,
      receivingProgress: {
        totalOrdered,
        totalReceived,
        percentComplete,
        fullyReceivedLinesCount,
      },
    };
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
      throwBadRequest('PO_LINES_REQUIRED', 'At least one line required');
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
        throwConflict('PO_ORDER_NUMBER_CONFLICT', 'orderNumber already exists');
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
      throwBadRequest('PO_NOT_DRAFT', 'Only DRAFT can be patched');
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
      throwBadRequest('PO_INVALID_STATUS', 'Only DRAFT can submit');
    }
    if (!po.lines.length) {
      throwBadRequest('PO_LINES_REQUIRED', 'PO has no lines');
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
      throwBadRequest('PO_INVALID_STATUS', 'Only DRAFT can cancel');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { lines: true },
    });
  }

  /** 依補貨建議建立 DRAFT 採購單；回傳 { id, orderNumber } */
  async createFromReplenishment(data: {
    supplierId: string;
    warehouseId: string;
    suggestions: { productId: string; suggestedQty: number }[];
  }): Promise<{ id: string; orderNumber: string }> {
    if (!data.suggestions?.length) {
      throwBadRequest('PO_LINES_REQUIRED', 'At least one suggestion required');
    }
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, merchantId: true },
    });
    if (!supplier) {
      throwNotFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
      select: { id: true, merchantId: true },
    });
    if (!warehouse) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }
    if (warehouse.merchantId !== supplier.merchantId) {
      throwBadRequest('PO_MERCHANT_MISMATCH', 'Supplier and warehouse must belong to same merchant');
    }
    const productIds = [...new Set(data.suggestions.map((s) => s.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, costPrice: true },
    });
    const costMap = new Map(products.map((p) => [p.id, p.costPrice != null ? Number(p.costPrice) : 0]));

    const lines = data.suggestions
      .filter((s) => s.suggestedQty > 0)
      .map((s) => ({
        productId: s.productId,
        qtyOrdered: s.suggestedQty,
        unitCost: costMap.get(s.productId) ?? 0,
      }));

    if (lines.length === 0) {
      throwBadRequest('PO_LINES_REQUIRED', 'At least one suggestion with suggestedQty > 0 required');
    }

    const orderNumber = `PO-RPL-${Date.now()}`;
    const po = await this.create({
      merchantId: supplier.merchantId,
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      orderNumber,
      lines,
    });
    return { id: po.id, orderNumber: po.orderNumber };
  }

  /**
   * 快速進貨：建立 PO(DRAFT) → submit → 建 RN → 填數量 → complete。
   * 目的：支援「選供應商→選品項→輸入數量→一鍵完成」。
   */
  async quickReceive(data: {
    merchantId: string;
    supplierId: string;
    warehouseId: string;
    orderNumber: string;
    inspectorName?: string;
    remark?: string;
    lines: {
      productId: string;
      qty: number;
      unitCost?: number;
      batchCode?: string | null;
      expiryDate?: string | null;
      /** 生產日期（與 shelfLifeMonths 搭配，二擇一於 expiryDate） */
      productionDate?: string | null;
      /** 有效期限月數（與 productionDate 搭配） */
      shelfLifeMonths?: number | null;
      weightUnit?: string | null;
    }[];
  }) {
    const merchantId = data.merchantId?.trim();
    if (!merchantId) {
      throwBadRequest('PO_MERCHANT_REQUIRED', 'merchantId required');
    }
    if (!data.supplierId?.trim()) {
      throwBadRequest('SUPPLIER_NOT_FOUND', 'supplierId required');
    }
    if (!data.warehouseId?.trim()) {
      throwBadRequest('INVENTORY_WAREHOUSE_NOT_FOUND', 'warehouseId required');
    }
    const orderNumber = (data.orderNumber ?? '').trim();
    if (!orderNumber) {
      throwBadRequest('PO_LINES_REQUIRED', 'orderNumber required');
    }
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      throwBadRequest('PO_LINES_REQUIRED', 'At least one line required');
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, merchantId: true, status: true },
    });
    if (!supplier || supplier.merchantId !== merchantId) {
      throwNotFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    if (supplier.status === 'INACTIVE') {
      throwBadRequest('SUPPLIER_IN_USE', 'Supplier inactive');
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
      select: { id: true, merchantId: true },
    });
    if (!warehouse || warehouse.merchantId !== merchantId) {
      throwNotFound('INVENTORY_WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }

    const productIds = [...new Set(data.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, costPrice: true },
    });
    const byProductId = new Map(products.map((p) => [p.id, p]));

    const lines = data.lines.map((l) => {
      const qty = Number(l.qty);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throwBadRequest('RN_COMPLETE_INVALID', 'qty must be a positive integer');
      }
      const p = byProductId.get(l.productId);
      if (!p) {
        throwBadRequest('INVENTORY_PRODUCT_NOT_FOUND', 'Unknown productId');
      }
      const unitCost =
        l.unitCost != null ? Number(l.unitCost) : Number(p.costPrice ?? 0);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throwBadRequest('RN_COMPLETE_INVALID', 'unitCost must be a non-negative number');
      }
      return {
        productId: l.productId,
        qty,
        unitCost: Math.round(unitCost * 100) / 100,
        batchCode: l.batchCode,
        expiryDate: l.expiryDate,
        productionDate: l.productionDate,
        shelfLifeMonths: l.shelfLifeMonths,
        weightUnit: l.weightUnit,
      };
    });

    const po = await this.create({
      merchantId,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      orderNumber,
      lines: lines.map((l) => ({
        productId: l.productId,
        qtyOrdered: l.qty,
        unitCost: l.unitCost,
      })),
    });
    await this.submit(po.id);

    const rn = await this.receivingNotes.create({
      merchantId,
      purchaseOrderId: po.id,
      inspectorName: data.inspectorName,
      remark: data.remark,
    });
    const rnFull = await this.receivingNotes.getById(rn.id);

    await this.receivingNotes.patchLines(
      rn.id,
      rnFull.lines.map((rl) => {
        const src = lines.find((x) => x.productId === rl.purchaseOrderLine.productId);
        return {
          lineId: rl.id,
          receivedQty: src?.qty ?? 0,
          qualifiedQty: src?.qty ?? 0,
          returnedQty: 0,
          batchCode: src?.batchCode,
          expiryDate: src?.expiryDate,
          productionDate: src?.productionDate,
          shelfLifeMonths: src?.shelfLifeMonths,
          weightUnit: src?.weightUnit,
        };
      }),
    );
    return this.receivingNotes.complete(rn.id);
  }
}
