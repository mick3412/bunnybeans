import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string, q?: string) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({
        message: 'merchantId required',
        code: 'SUPPLIER_MERCHANT_REQUIRED',
      });
    }
    const where: Prisma.SupplierWhereInput = { merchantId: m };
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { contactPerson: { contains: s, mode: 'insensitive' } },
      ];
    }
    return this.prisma.supplier.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string, merchantId?: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    if (merchantId && s.merchantId !== merchantId) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    const onTimeThresholdDays = 3;
    const lead = await this.prisma.$queryRaw<
      { totalCompleted: number; onTimeCount: number; avgDays: number | null }[]
    >`
      SELECT
        COUNT(*)::int AS "totalCompleted",
        SUM(
          CASE
            WHEN (EXTRACT(EPOCH FROM (rn."updatedAt" - COALESCE(po."orderDate", po."createdAt"))) / 86400.0) <= ${onTimeThresholdDays}
            THEN 1 ELSE 0
          END
        )::int AS "onTimeCount",
        AVG(EXTRACT(EPOCH FROM (rn."updatedAt" - COALESCE(po."orderDate", po."createdAt"))) / 86400.0) AS "avgDays"
      FROM "ReceivingNote" rn
      JOIN "PurchaseOrder" po ON po.id = rn."purchaseOrderId"
      WHERE po."supplierId" = ${s.id}
        AND rn.status = 'COMPLETED'
    `;
    const leadRow = lead[0] ?? { totalCompleted: 0, onTimeCount: 0, avgDays: null };

    const qualified = await this.prisma.$queryRaw<{ qualifiedQty: number }[]>`
      SELECT COALESCE(SUM(rnl."qualifiedQty"), 0)::int AS "qualifiedQty"
      FROM "ReceivingNoteLine" rnl
      JOIN "ReceivingNote" rn ON rn.id = rnl."receivingNoteId"
      JOIN "PurchaseOrder" po ON po.id = rn."purchaseOrderId"
      WHERE po."supplierId" = ${s.id}
        AND rn.status = 'COMPLETED'
    `;
    const qualifiedQty = Number((qualified[0] as any)?.qualifiedQty ?? 0);

    const returned = await this.prisma.$queryRaw<{ returnedQty: number }[]>`
      SELECT COALESCE(ABS(SUM(ie."quantity")), 0)::int AS "returnedQty"
      FROM "InventoryEvent" ie
      JOIN "ReceivingNoteLine" rnl ON rnl.id = ie."referenceId"
      JOIN "ReceivingNote" rn ON rn.id = rnl."receivingNoteId"
      JOIN "PurchaseOrder" po ON po.id = rn."purchaseOrderId"
      WHERE po."supplierId" = ${s.id}
        AND ie.type = 'RETURN_TO_SUPPLIER'
    `;
    const returnedQty = Number((returned[0] as any)?.returnedQty ?? 0);

    const deliveryOnTimeRate =
      leadRow.totalCompleted > 0
        ? Math.round((leadRow.onTimeCount / leadRow.totalCompleted) * 1000) / 1000
        : null;
    const deliveryLeadTimeDaysAvg =
      leadRow.avgDays != null ? Math.round(leadRow.avgDays * 100) / 100 : null;
    const returnRate =
      qualifiedQty > 0
        ? Math.round((returnedQty / qualifiedQty) * 1000) / 1000
        : null;

    return {
      ...s,
      kpis: {
        deliveryOnTimeThresholdDays: onTimeThresholdDays,
        deliveryOnTimeRate,
        deliveryLeadTimeDaysAvg,
        qualifiedQty,
        returnedQty,
        returnRate,
      },
    };
  }

  async create(data: {
    merchantId: string;
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    paymentTerms?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    email?: string;
    address?: string;
    taxId?: string;
    bankAccount?: string;
    note?: string;
  }) {
    try {
      return await this.prisma.supplier.create({
        data: {
          merchantId: data.merchantId.trim(),
          code: data.code.trim(),
          name: data.name.trim(),
          contactPerson: data.contactPerson?.trim() || null,
          phone: data.phone?.trim() || null,
          paymentTerms: data.paymentTerms?.trim() || null,
          status: data.status ?? 'ACTIVE',
          email: data.email?.trim() || null,
          address: data.address?.trim() || null,
          taxId: data.taxId?.trim() || null,
          bankAccount: data.bankAccount?.trim() || null,
          note: data.note?.trim() || null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Supplier code already exists for merchant',
          code: 'SUPPLIER_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async update(
    id: string,
    data: Partial<{
      code: string;
      name: string;
      contactPerson: string;
      phone: string;
      paymentTerms: string;
      status: 'ACTIVE' | 'INACTIVE';
      email: string;
      address: string;
      taxId: string;
      bankAccount: string;
      note: string;
    }>,
  ) {
    await this.getById(id);
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(data.code != null && { code: data.code.trim() }),
          ...(data.name != null && { name: data.name.trim() }),
          ...(data.contactPerson !== undefined && {
            contactPerson: data.contactPerson?.trim() || null,
          }),
          ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
          ...(data.paymentTerms !== undefined && {
            paymentTerms: data.paymentTerms?.trim() || null,
          }),
          ...(data.status != null && { status: data.status }),
          ...(data.email !== undefined && { email: data.email?.trim() || null }),
          ...(data.address !== undefined && { address: data.address?.trim() || null }),
          ...(data.taxId !== undefined && { taxId: data.taxId?.trim() || null }),
          ...(data.bankAccount !== undefined && {
            bankAccount: data.bankAccount?.trim() || null,
          }),
          ...(data.note !== undefined && { note: data.note?.trim() || null }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Supplier code already exists for merchant',
          code: 'SUPPLIER_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async delete(id: string) {
    await this.getById(id);
    const openPo = await this.prisma.purchaseOrder.findFirst({
      where: {
        supplierId: id,
        status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] },
      },
    });
    if (openPo) {
      throw new ConflictException({
        message: 'Supplier has open purchase orders',
        code: 'SUPPLIER_IN_USE',
      });
    }
    const openRn = await this.prisma.receivingNote.findFirst({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        purchaseOrder: { supplierId: id },
      },
    });
    if (openRn) {
      throw new ConflictException({
        message: 'Supplier has open receiving notes',
        code: 'SUPPLIER_IN_USE',
      });
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }
}
