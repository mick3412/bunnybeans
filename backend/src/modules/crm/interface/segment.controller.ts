import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { SegmentService } from '../application/segment.service';

@Controller('crm/segments')
export class SegmentController {
  constructor(private readonly segmentService: SegmentService) {}

  /** GET /crm/segments — 列表（merchantId 必填、page、pageSize） */
  @Get()
  @UseGuards(AdminApiKeyGuard)
  list(
    @Query('merchantId') merchantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.segmentService.listSegments(merchantId ?? '', p, ps);
  }

  /** GET /crm/segments/:id/preview — 階段 E 分群預覽，回傳 customerIds 與 count */
  @Get(':id/preview')
  getPreview(@Param('id') id: string) {
    return this.segmentService.getPreview(id);
  }

  /** GET /crm/segments/:id/export — 分群名單匯出 CSV（Admin） */
  @Get(':id/export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="segment-members.csv"')
  async getExport(@Param('id') id: string, @Res({ passthrough: false }) res: Response) {
    const csv = await this.segmentService.getExportCsv(id);
    res.send(csv);
  }
}
