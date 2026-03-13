import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MerchantService } from '../application/merchant.service';

@Controller()
export class MerchantController {
  constructor(private readonly service: MerchantService) {}

  // Merchants

  @Get('merchants')
  listMerchants() {
    return this.service.listMerchants();
  }

  @Get('merchants/:id')
  getMerchant(@Param('id') id: string) {
    return this.service.getMerchant(id);
  }

  @Post('merchants')
  createMerchant(
    @Body()
    body: {
      code: string;
      name: string;
    },
  ) {
    return this.service.createMerchant(body);
  }

  @Patch('merchants/:id')
  updateMerchant(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
    },
  ) {
    return this.service.updateMerchant(id, body);
  }

  @Delete('merchants/:id')
  deleteMerchant(@Param('id') id: string) {
    return this.service.deleteMerchant(id);
  }

  // Stores

  @Get('stores')
  listStores() {
    return this.service.listStores();
  }

  @Get('stores/:id')
  getStore(@Param('id') id: string) {
    return this.service.getStore(id);
  }

  @Post('stores')
  createStore(
    @Body()
    body: {
      code: string;
      name: string;
      merchantId: string;
    },
  ) {
    return this.service.createStore(body);
  }

  @Patch('stores/:id')
  updateStore(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
    },
  ) {
    return this.service.updateStore(id, body);
  }

  @Delete('stores/:id')
  deleteStore(@Param('id') id: string) {
    return this.service.deleteStore(id);
  }

  // Warehouses

  @Get('warehouses')
  listWarehouses() {
    return this.service.listWarehouses();
  }

  @Get('warehouses/:id')
  getWarehouse(@Param('id') id: string) {
    return this.service.getWarehouse(id);
  }

  @Post('warehouses')
  createWarehouse(
    @Body()
    body: {
      code: string;
      name: string;
      merchantId: string;
      storeId?: string | null;
    },
  ) {
    return this.service.createWarehouse(body);
  }

  @Patch('warehouses/:id')
  updateWarehouse(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      storeId?: string | null;
    },
  ) {
    return this.service.updateWarehouse(id, body);
  }

  @Delete('warehouses/:id')
  deleteWarehouse(@Param('id') id: string) {
    return this.service.deleteWarehouse(id);
  }
}

