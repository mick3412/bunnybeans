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
