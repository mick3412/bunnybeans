import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PosReturnService } from '../application/pos-return.service';
import { StoreCreditService } from '../application/store-credit.service';
import { PreviewReturnDto, ExecuteReturnDto } from '../dto/create-return.dto';

@Controller('pos')
export class PosReturnsController {
  constructor(
    private readonly service: PosReturnService,
    private readonly storeCreditService: StoreCreditService,
  ) {}

  @Post('orders/:orderId/returns/preview')
  @HttpCode(200)
  @UseGuards(AdminApiKeyGuard)
  preview(
    @Param('orderId') orderId: string,
    @Body() body: PreviewReturnDto,
  ) {
    return this.service.previewReturn(orderId, body);
  }

  @Post('orders/:orderId/returns')
  @HttpCode(201)
  @UseGuards(AdminApiKeyGuard)
  execute(
    @Param('orderId') orderId: string,
    @Body() body: ExecuteReturnDto,
  ) {
    return this.service.executeReturn(orderId, body);
  }

  @Get('returns')
  list(
    @Query('storeId') storeId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listReturns({
      storeId,
      type,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('returns/:id')
  getReturn(@Param('id') id: string) {
    return this.service.getReturnById(id);
  }

  @Get('store-credit/:customerId')
  getStoreCredit(
    @Param('customerId') customerId: string,
    @Query('merchantId') merchantId?: string,
  ) {
    if (merchantId?.trim()) {
      return this.storeCreditService.getBalanceForStore(
        customerId,
        merchantId.trim(),
      );
    }
    return this.storeCreditService.getBalance(customerId).then((balance) => ({
      customerId,
      balance,
    }));
  }
}
