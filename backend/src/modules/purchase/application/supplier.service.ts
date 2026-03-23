import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    merchantId: string,
    q?: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('SUPPLIER_MERCHANT_REQUIRED', 'merchantId required');
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
    const page = opts?.page ?? 1;
    const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string, merchantId?: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) {
      throwNotFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    if (merchantId && s.merchantId !== merchantId) {
      throwNotFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    const onTimeThresholdDays = 3;
    const [kpisRow] = await this.prisma.$queryRaw<
      Array<{
        totalCompleted: number;
        onTimeCount: number;
        avgDays: number | null;
        qualifiedQty: number;
        returnedQty: number;
      }>
    >`
      WITH completed_rn AS (
        SELECT rn.id AS "rnId",
          rn."updatedAt",
          po."orderDate",
          po."createdAt"
        FROM "ReceivingNote" rn
        JOIN "PurchaseOrder" po ON po.id = rn."purchaseOrderId"
        WHERE po."supplierId" = ${s.id}
          AND rn.status = 'COMPLETED'
      ),
      lead_agg AS (
        SELECT
          COUNT(*)::int AS "totalCompleted",
          SUM(
            CASE
              WHEN (EXTRACT(EPOCH FROM (cr."updatedAt" - COALESCE(cr."orderDate", cr."createdAt"))) / 86400.0) <= ${onTimeThresholdDays}
              THEN 1 ELSE 0
            END
          )::int AS "onTimeCount",
          AVG(EXTRACT(EPOCH FROM (cr."updatedAt" - COALESCE(cr."orderDate", cr."createdAt"))) / 86400.0) AS "avgDays"
        FROM completed_rn cr
      ),
      qualified_agg AS (
        SELECT COALESCE(SUM(rnl."qualifiedQty"), 0)::int AS "qualifiedQty"
        FROM "ReceivingNoteLine" rnl
        JOIN completed_rn cr ON cr."rnId" = rnl."receivingNoteId"
      ),
      returned_agg AS (
        SELECT COALESCE(ABS(SUM(ie."quantity")), 0)::int AS "returnedQty"
        FROM "InventoryEvent" ie
        JOIN "ReceivingNoteLine" rnl ON rnl.id = ie."referenceId"
        JOIN "ReceivingNote" rn ON rn.id = rnl."receivingNoteId"
        JOIN "PurchaseOrder" po ON po.id = rn."purchaseOrderId"
        WHERE po."supplierId" = ${s.id}
          AND ie.type = 'RETURN_TO_SUPPLIER'
      )
      SELECT
        l."totalCompleted",
        l."onTimeCount",
        l."avgDays",
        q."qualifiedQty",
        r."returnedQty"
      FROM lead_agg l
      CROSS JOIN qualified_agg q
      CROSS JOIN returned_agg r
    `;
    const leadRow = kpisRow ?? { totalCompleted: 0, onTimeCount: 0, avgDays: null, qualifiedQty: 0, returnedQty: 0 };
    const qualifiedQty = Number(leadRow.qualifiedQty ?? 0);
    const returnedQty = Number(leadRow.returnedQty ?? 0);

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
        throwConflict('SUPPLIER_CODE_CONFLICT', 'Supplier code already exists for merchant');
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
        throwConflict('SUPPLIER_CODE_CONFLICT', 'Supplier code already exists for merchant');
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
      throwConflict('SUPPLIER_IN_USE', 'Supplier has open purchase orders');
    }
    const openRn = await this.prisma.receivingNote.findFirst({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        purchaseOrder: { supplierId: id },
      },
    });
    if (openRn) {
      throwConflict('SUPPLIER_IN_USE', 'Supplier has open receiving notes');
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }
}
