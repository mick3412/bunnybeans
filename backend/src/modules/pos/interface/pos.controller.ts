import {
  Body,
  Controller,
  Get,
  HttpCode,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PosService } from '../application/pos.service';
import { CreatePosOrderDto } from '../dto/create-pos-order.dto';

@Controller('pos/orders')
export class PosController {
  constructor(private readonly service: PosService) {}

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(@Body() body: CreatePosOrderDto) {
    return this.service.createOrder({
      storeId: body.storeId,
      occurredAt: body.occurredAt,
      items: body.items,
      payments: body.payments ?? [],
      customerId: body.customerId,
      exchangeFromOrderId: body.exchangeFromOrderId,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      allowCredit: body.allowCredit,
      pointsToRedeem: body.pointsToRedeem,
    });
  }

  /** 須在 Get(':id') 之前註冊，避免與單段 id 混淆 */
  @Post(':id/payments')
  @HttpCode(201)
  @UseGuards(AdminApiKeyGuard)
  appendPayment(
    @Param('id') id: string,
    @Body() body: { method: string; amount: number; occurredAt?: string },
  ) {
    return this.service.appendPaymentToOrder(id, body);
  }

  @Post(':id/refunds')
  @HttpCode(201)
  @UseGuards(AdminApiKeyGuard)
  refund(
    @Param('id') id: string,
    @Body() body: { amount: number; occurredAt?: string; note?: string },
  ) {
    return this.service.refundToOrder(id, body);
  }

  /** 舊路徑保留；若環境對連字路徑回 404，請用 returns/stock */
  @Post(':id/return-to-stock')
  @HttpCode(201)
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
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
    @Query('hasRefund') hasRefund?: string,
    @Query('hasReturn') hasReturn?: string,
    @Query('hasExchange') hasExchange?: string,
    @Query('afterSalesOnly') afterSalesOnly?: string,
  ) {
    const asBool = (v?: string): boolean | undefined => {
      if (v == null) return undefined;
      const s = v.trim().toLowerCase();
      if (s === '1' || s === 'true') return true;
      if (s === '0' || s === 'false') return false;
      return undefined;
    };
    return this.service.listOrders({
      storeId,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      hasRefund: asBool(hasRefund),
      hasReturn: asBool(hasReturn),
      hasExchange: asBool(hasExchange),
      afterSalesOnly: asBool(afterSalesOnly),
    });
  }

  /** 須在 Get(':id') 之前 */
  @Get('export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="pos-orders.csv"')
  async export(
    @Res({ passthrough: false }) res: Response,
    @Query('storeId') storeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeLines') includeLines?: string,
  ) {
    const csv = await this.service.exportOrdersCsv({
      storeId,
      from,
      to,
      includeLines:
        includeLines === '1' || includeLines?.toLowerCase() === 'true',
    });
    res.send('\uFEFF' + csv);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getOrderById(id);
  }
}
