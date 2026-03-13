import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { InventoryEventType } from '@prisma/client';
import {
  InventoryBalanceFilter,
  InventoryEventFilter,
  InventoryService,
  RecordInventoryEventInput,
  TransferInventoryInput,
} from '../application/inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('transfer')
  @UseGuards(AdminApiKeyGuard)
  transfer(@Body() body: TransferInventoryInput) {
    return this.service.transferInventory(body);
  }

  @Post('events')
  @UseGuards(AdminApiKeyGuard)
  recordEvent(
    @Body()
    body: RecordInventoryEventInput,
  ) {
    return this.service.recordInventoryEvent(body);
  }

  @Get('balances/enriched')
  getBalancesEnriched(@Query('warehouseId') warehouseId: string) {
    return this.service.getBalancesEnriched(warehouseId);
  }

  @Get('balances')
  getBalances(
    @Query('productId') productId?: string | string[],
    @Query('warehouseId') warehouseId?: string | string[],
  ) {
    const toArray = (value?: string | string[]) =>
      typeof value === 'string' ? [value] : value;

    const filter: InventoryBalanceFilter = {
      productIds: toArray(productId),
      warehouseIds: toArray(warehouseId),
    };

    return this.service.getBalances(filter);
  }

  @Get('events/export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory-events.csv"')
  async exportEvents(
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: InventoryEventType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const csv = await this.service.exportEventsCsv({
      productId,
      warehouseId,
      type,
      from,
      to,
    });
    res!.send('\uFEFF' + csv);
  }

  @Get('events')
  getEvents(
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: InventoryEventType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const filter: InventoryEventFilter = {
      productId,
      warehouseId,
      type,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    };

    return this.service.getEvents(filter);
  }
}

