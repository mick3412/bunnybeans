import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { ReceivingNoteService } from '../application/receiving-note.service';
import { CreateReceivingNoteDto } from '../dto/create-receiving-note.dto';
import { PatchReceivingNoteLinesDto } from '../dto/patch-receiving-note-lines.dto';
import { ReturnToSupplierDto } from '../dto/return-to-supplier.dto';

@Controller('receiving-notes')
@UseGuards(AdminApiKeyGuard)
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
  create(@Body() body: CreateReceivingNoteDto) {
    return this.svc.create(body);
  }

  @Patch(':id/lines')
  patchLines(@Param('id') id: string, @Body() body: PatchReceivingNoteLinesDto) {
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

  @Post(':id/return-to-supplier')
  returnToSupplier(@Param('id') id: string, @Body() body: ReturnToSupplierDto) {
    return this.svc.returnToSupplier(id, body);
  }
}
