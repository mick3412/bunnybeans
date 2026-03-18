import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { InventoryEventType } from '@prisma/client';
import {
  ExpiringInventoryFilter,
  InventoryBalanceFilter,
  InventoryEventFilter,
  InventoryService,
  RecordInventoryEventInput,
  ReplenishmentSuggestionsFilter,
  SlowMovingFilter,
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

  /** 與 POST events/import 相同；單段 path 避免舊版／代理對 events/import 誤判 404 */
  @Post('import')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  importCsvAlias(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file (CSV) required',
        code: 'INVENTORY_IMPORT_FILE_REQUIRED',
      });
    }
    return this.service.importEventsFromCsvBuffer(file.buffer);
  }

  @Post('events/import')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  importEvents(
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file (CSV) required',
        code: 'INVENTORY_IMPORT_FILE_REQUIRED',
      });
    }
    return this.service.importEventsFromCsvBuffer(file.buffer);
  }

  @Post('events/batch-stocktake')
  @UseGuards(AdminApiKeyGuard)
  batchStocktake(
    @Body()
    body: {
      warehouseId: string;
      lines: { productId: string; actualQty: number }[];
    },
  ) {
    return this.service.batchStocktake(body);
  }

  /**
   * 掃碼盤點：以 sku（後續可擴充 barcode）輸入實際數量。
   */
  @Post('events/scan-stocktake')
  @UseGuards(AdminApiKeyGuard)
  scanStocktake(
    @Body()
    body: {
      warehouseId: string;
      lines: { sku: string; actualQty: number }[];
    },
  ) {
    return this.service.scanStocktake(body);
  }

  @Post('events')
  @UseGuards(AdminApiKeyGuard)
  recordEvent(
    @Body()
    body: RecordInventoryEventInput,
  ) {
    return this.service.recordInventoryEvent(body);
  }

  @Get('balances/export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="inventory-balances.csv"',
  )
  async exportBalances(
    @Query('warehouseId') warehouseId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const csv = await this.service.exportBalancesCsv(warehouseId);
    res.send('\uFEFF' + csv);
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

  @Get('expiring')
  getExpiring(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('daysAhead') daysAhead?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const filter: ExpiringInventoryFilter = {
      warehouseId,
      productId,
      from,
      to,
      daysAhead: daysAhead ? Number(daysAhead) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    };
    return this.service.getExpiring(filter);
  }

  @Get('slow-moving')
  getSlowMoving(
    @Query('merchantId') merchantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('lookbackDays') lookbackDays?: string,
    @Query('salesThreshold') salesThreshold?: string,
    @Query('onHandThreshold') onHandThreshold?: string,
  ) {
    const filter: SlowMovingFilter = {
      merchantId,
      warehouseId,
      lookbackDays: lookbackDays ? Number(lookbackDays) : undefined,
      salesThreshold: salesThreshold != null ? Number(salesThreshold) : undefined,
      onHandThreshold: onHandThreshold != null ? Number(onHandThreshold) : undefined,
    };
    return this.service.getSlowMoving(filter);
  }

  @Get('replenishment-suggestions')
  getReplenishmentSuggestions(
    @Query('merchantId') merchantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('daysLookback') daysLookback?: string,
    @Query('daysAhead') daysAhead?: string,
    @Query('safetyDays') safetyDays?: string,
    @Query('minSuggestedQty') minSuggestedQty?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const filter: ReplenishmentSuggestionsFilter = {
      merchantId,
      warehouseId,
      daysLookback: daysLookback ? Number(daysLookback) : undefined,
      daysAhead: daysAhead ? Number(daysAhead) : undefined,
      safetyDays: safetyDays ? Number(safetyDays) : undefined,
      minSuggestedQty: minSuggestedQty ? Number(minSuggestedQty) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    };
    return this.service.getReplenishmentSuggestions(filter);
  }
}

