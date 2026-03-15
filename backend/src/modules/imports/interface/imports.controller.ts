import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { checkImportJobRateLimit } from '../application/import-job-rate-limit';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import {
  ImportsService,
  ImportJobKind,
} from '../application/imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post('jobs/:kind')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  async createJobByKind(
    @Param('kind') kind: string,
    @UploadedFile() file?: { buffer: Buffer },
    @Req() req?: Request,
  ) {
    const ip =
      (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'local';
    const rl = checkImportJobRateLimit(ip);
    if (!rl.ok) {
      throw new HttpException(
        {
          message: 'at most 10 import jobs per minute per client',
          code: 'IMPORT_JOB_RATE_LIMIT',
          retryAfterSec: rl.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'file required',
        code: 'IMPORT_FILE_REQUIRED',
      });
    }
    const k = kind.trim() as ImportJobKind;
    if (k !== 'products_csv' && k !== 'inventory_csv') {
      throw new BadRequestException({
        message: 'kind must be products_csv or inventory_csv',
        code: 'IMPORT_KIND_INVALID',
      });
    }
    return this.service.createJob(k, file.buffer);
  }

  @Get('jobs/:id')
  @UseGuards(AdminApiKeyGuard)
  getJob(@Param('id') id: string) {
    return this.service.getJob(id);
  }
}
