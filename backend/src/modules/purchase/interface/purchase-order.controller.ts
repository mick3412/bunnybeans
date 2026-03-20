import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PurchaseOrderService } from '../application/purchase-order.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { CreateFromReplenishmentDto } from '../dto/create-from-replenishment.dto';
import { QuickReceiveDto } from '../dto/quick-receive.dto';
import { PatchPurchaseOrderDto } from '../dto/patch-purchase-order.dto';

@Controller('purchase-orders')
@UseGuards(AdminApiKeyGuard)
export class PurchaseOrderController {
  constructor(private readonly svc: PurchaseOrderService) {}

  @Get()
  list(
    @Query('merchantId') merchantId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.list(merchantId, status, q);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Query('merchantId') merchantId?: string) {
    return this.svc.getById(id, merchantId);
  }

  @Post('from-replenishment')
  createFromReplenishment(@Body() body: CreateFromReplenishmentDto) {
    return this.svc.createFromReplenishment(body);
  }

  /**
   * 快速進貨：一鍵建立 PO + RN + complete（並寫入 Inventory/Finance events）。
   * UI flow: 選供應商 → 選品項 → 輸入數量 → 完成。
   */
  @Post('quick-receive')
  quickReceive(@Body() body: QuickReceiveDto) {
    return this.svc.quickReceive(body);
  }

  @Post()
  create(@Body() body: CreatePurchaseOrderDto) {
    return this.svc.create(body);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: PatchPurchaseOrderDto) {
    return this.svc.patchDraft(id, body);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.svc.submit(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.svc.cancel(id);
  }
}
