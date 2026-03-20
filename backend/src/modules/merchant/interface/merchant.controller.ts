import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { MerchantService } from '../application/merchant.service';
import { CreateMerchantDto } from '../dto/create-merchant.dto';

@Controller()
export class MerchantController {
  constructor(private readonly service: MerchantService) {}

  // Single merchant (optional; for single-tenant frontend)
  @Get('merchant/current')
  getCurrentMerchant() {
    return this.service.getCurrentMerchant();
  }

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
  @UseGuards(AdminApiKeyGuard)
  createMerchant(@Body() body: CreateMerchantDto) {
    return this.service.createMerchant(body);
  }

  @Patch('merchants/:id')
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
  deleteWarehouse(@Param('id') id: string) {
    return this.service.deleteWarehouse(id);
  }
}

