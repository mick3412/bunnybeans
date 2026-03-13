import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantRepository } from '../infrastructure/merchant.repository';

interface CreateMerchantInput {
  code: string;
  name: string;
}

interface UpdateMerchantInput {
  code?: string;
  name?: string;
}

interface CreateStoreInput {
  code: string;
  name: string;
  merchantId: string;
}

interface UpdateStoreInput {
  code?: string;
  name?: string;
}

interface CreateWarehouseInput {
  code: string;
  name: string;
  merchantId: string;
  storeId?: string | null;
}

interface UpdateWarehouseInput {
  code?: string;
  name?: string;
  storeId?: string | null;
}

@Injectable()
export class MerchantService {
  constructor(private readonly repo: MerchantRepository) {}

  listMerchants() {
    return this.repo.findAllMerchants();
  }

  async getMerchant(id: string) {
    const merchant = await this.repo.findMerchantById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  createMerchant(input: CreateMerchantInput) {
    return this.repo.createMerchant(input);
  }

  async updateMerchant(id: string, input: UpdateMerchantInput) {
    await this.getMerchant(id);
    return this.repo.updateMerchant(id, input);
  }

  async deleteMerchant(id: string) {
    await this.getMerchant(id);
    await this.repo.deleteMerchant(id);
    return { success: true };
  }

  async listStores() {
    const rows = await this.repo.findAllStores();
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      merchantId: s.merchantId,
      warehouseIds: s.warehouses.map((w) => w.id),
    }));
  }

  async getStore(id: string) {
    const store = await this.repo.findStoreById(id);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  createStore(input: CreateStoreInput) {
    return this.repo.createStore(input);
  }

  async updateStore(id: string, input: UpdateStoreInput) {
    await this.getStore(id);
    return this.repo.updateStore(id, input);
  }

  async deleteStore(id: string) {
    await this.getStore(id);
    await this.repo.deleteStore(id);
    return { success: true };
  }

  listWarehouses() {
    return this.repo.findAllWarehouses();
  }

  async getWarehouse(id: string) {
    const warehouse = await this.repo.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    return warehouse;
  }

  createWarehouse(input: CreateWarehouseInput) {
    return this.repo.createWarehouse(input);
  }

  async updateWarehouse(id: string, input: UpdateWarehouseInput) {
    await this.getWarehouse(id);
    return this.repo.updateWarehouse(id, input);
  }

  async deleteWarehouse(id: string) {
    await this.getWarehouse(id);
    await this.repo.deleteWarehouse(id);
    return { success: true };
  }
}

