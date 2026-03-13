import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PosService } from '../application/pos.service';

@Controller('pos/orders')
export class PosController {
  constructor(private readonly service: PosService) {}

  @Post()
  create(
    @Body()
    body: {
      storeId: string;
      occurredAt?: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
      payments: Array<{ method: string; amount: number }>;
      customerId?: string | null;
    },
  ) {
    return this.service.createOrder({
      storeId: body.storeId,
      occurredAt: body.occurredAt,
      items: body.items,
      payments: body.payments ?? [],
      customerId: body.customerId,
    });
  }

  @Get()
  list(
    @Query('storeId') storeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listOrders({
      storeId,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getOrderById(id);
  }
}
