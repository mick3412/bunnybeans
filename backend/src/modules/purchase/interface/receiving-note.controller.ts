import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReceivingNoteService } from '../application/receiving-note.service';

@Controller('receiving-notes')
export class ReceivingNoteController {
  constructor(private readonly svc: ReceivingNoteService) {}

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
      purchaseOrderId: string;
      inspectorName?: string;
      remark?: string;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id/lines')
  patchLines(
    @Param('id') id: string,
    @Body()
    body: {
      lines: {
        lineId: string;
        receivedQty?: number;
        qualifiedQty?: number;
        returnedQty?: number;
        returnReason?: string;
      }[];
    },
  ) {
    return this.svc.patchLines(id, body.lines ?? []);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.svc.complete(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.svc.reject(id);
  }
}
