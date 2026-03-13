import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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
      allowCredit?: boolean;
    },
  ) {
    return this.service.createOrder({
      storeId: body.storeId,
      occurredAt: body.occurredAt,
      items: body.items,
      payments: body.payments ?? [],
      customerId: body.customerId,
      allowCredit: body.allowCredit,
    });
  }

  /** 須在 Get(':id') 之前註冊，避免與單段 id 混淆 */
  @Post(':id/payments')
  @HttpCode(201)
  appendPayment(
    @Param('id') id: string,
    @Body() body: { method: string; amount: number; occurredAt?: string },
  ) {
    return this.service.appendPaymentToOrder(id, body);
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
