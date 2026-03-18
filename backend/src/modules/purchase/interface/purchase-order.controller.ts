import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PurchaseOrderService } from '../application/purchase-order.service';

@Controller('purchase-orders')
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
  createFromReplenishment(
    @Body()
    body: {
      supplierId: string;
      warehouseId: string;
      suggestions: { productId: string; suggestedQty: number }[];
    },
  ) {
    return this.svc.createFromReplenishment(body);
  }

  /**
   * 快速進貨：一鍵建立 PO + RN + complete（並寫入 Inventory/Finance events）。
   * UI flow: 選供應商 → 選品項 → 輸入數量 → 完成。
   */
  @Post('quick-receive')
  quickReceive(
    @Body()
    body: {
      merchantId: string;
      supplierId: string;
      warehouseId: string;
      orderNumber: string;
      inspectorName?: string;
      remark?: string;
      lines: {
        productId: string;
        qty: number;
        unitCost?: number;
        batchCode?: string | null;
        expiryDate?: string | null;
        weightUnit?: string | null;
      }[];
    },
  ) {
    return this.svc.quickReceive(body);
  }

  @Post()
  create(
    @Body()
    body: {
      merchantId: string;
      supplierId: string;
      warehouseId: string;
      orderNumber: string;
      expectedDate?: string;
      lines: { productId: string; qtyOrdered: number; unitCost: number }[];
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Body()
    body: {
      expectedDate?: string | null;
      lines?: { productId: string; qtyOrdered: number; unitCost: number }[];
    },
  ) {
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
