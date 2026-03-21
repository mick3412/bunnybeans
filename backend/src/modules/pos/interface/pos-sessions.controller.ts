import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PosSessionsService } from '../application/pos-sessions.service';

@Controller('pos/sessions')
export class PosSessionsController {
  constructor(private readonly service: PosSessionsService) {}

  @Post('open')
  @UseGuards(AdminApiKeyGuard)
  open(@Body() body: { storeId: string; openingCashAmount: number; openedBy?: string }) {
    return this.service.openSession({
      storeId: body.storeId,
      openingCashAmount: Number(body.openingCashAmount),
      openedBy: body.openedBy,
    });
  }

  /** 須在 Get(':id') 之前，避免 current 被當成 id */
  @Get('current')
  getCurrent(@Query('storeId') storeId?: string) {
    if (!storeId?.trim()) {
      return null;
    }
    return this.service.getCurrentSession(storeId.trim());
  }

  @Post(':id/close')
  @UseGuards(AdminApiKeyGuard)
  close(
    @Param('id') id: string,
    @Body() body: { actualCashAmount: number; closedBy?: string; note?: string },
  ) {
    return this.service.closeSession(id, {
      actualCashAmount: Number(body.actualCashAmount),
      closedBy: body.closedBy,
      note: body.note,
    });
  }

  @Get()
  list(
    @Query('storeId') storeId?: string,
    @Query('merchantId') merchantId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listSessions({
      storeId,
      merchantId,
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getSessionById(id);
  }
}
