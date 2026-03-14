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
    return s;
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
