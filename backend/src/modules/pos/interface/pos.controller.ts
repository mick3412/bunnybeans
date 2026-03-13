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

  @Post(':id/refunds')
  @HttpCode(201)
  refund(
    @Param('id') id: string,
    @Body() body: { amount: number; occurredAt?: string; note?: string },
  ) {
    return this.service.refundToOrder(id, body);
  }

  /** 舊路徑保留；若環境對連字路徑回 404，請用 returns/stock */
  @Post(':id/return-to-stock')
  @HttpCode(201)
  returnToStock(
    @Param('id') id: string,
    @Body()
    body: {
      items: Array<{ productId: string; quantity: number }>;
      occurredAt?: string;
    },
  ) {
    return this.service.returnToStock(id, body);
  }

  @Post(':id/returns/stock')
  @HttpCode(201)
  returnToStockAlias(
    @Param('id') id: string,
    @Body()
    body: {
      items: Array<{ productId: string; quantity: number }>;
      occurredAt?: string;
    },
  ) {
    return this.service.returnToStock(id, body);
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
