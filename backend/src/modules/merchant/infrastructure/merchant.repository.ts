import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class MerchantRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllMerchants() {
    return this.prisma.merchant.findMany({
      orderBy: { code: 'asc' },
    });
  }

  findMerchantById(id: string) {
    return this.prisma.merchant.findUnique({ where: { id } });
  }

  createMerchant(data: { code: string; name: string }) {
    return this.prisma.merchant.create({ data });
  }

  updateMerchant(id: string, data: { code?: string; name?: string }) {
    return this.prisma.merchant.update({
      where: { id },
      data,
    });
  }

  deleteMerchant(id: string) {
    return this.prisma.merchant.delete({ where: { id } });
  }

  findAllStores() {
    return this.prisma.store.findMany({
      orderBy: { code: 'asc' },
    });
  }

  findStoreById(id: string) {
    return this.prisma.store.findUnique({ where: { id } });
  }

  createStore(data: { code: string; name: string; merchantId: string }) {
    return this.prisma.store.create({ data });
  }

  updateStore(id: string, data: { code?: string; name?: string }) {
    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  deleteStore(id: string) {
    return this.prisma.store.delete({ where: { id } });
  }

  findAllWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: { code: 'asc' },
    });
  }

  findWarehouseById(id: string) {
    return this.prisma.warehouse.findUnique({ where: { id } });
  }

  createWarehouse(data: {
    code: string;
    name: string;
    merchantId: string;
    storeId?: string | null;
  }) {
    return this.prisma.warehouse.create({ data });
  }

  updateWarehouse(
    id: string,
    data: { code?: string; name?: string; storeId?: string | null },
  ) {
    return this.prisma.warehouse.update({
      where: { id },
      data,
    });
  }

  deleteWarehouse(id: string) {
    return this.prisma.warehouse.delete({ where: { id } });
  }
}

