import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import {
  CustomerService,
  type CustomerImportApplyDecision,
} from '../application/customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  /** GET 唯讀；POS 促銷試算選客戶用（與 seed memberLevel 對齊） */
  @Get()
  list(@Query('merchantId') merchantId: string) {
    return this.service.listByMerchant(merchantId);
  }

  @Post('import')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Query('merchantId') merchantId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file required',
        code: 'CUSTOMER_IMPORT_FILE_REQUIRED',
      });
    }
    return this.service.importFromCsvBuffer(merchantId, file.buffer);
  }

  /** 預覽：不寫入；回傳 fileHash（apply 必傳，且須上傳同檔）。 */
  @Post('import/preview')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  previewImport(
    @Query('merchantId') merchantId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file required',
        code: 'CUSTOMER_IMPORT_FILE_REQUIRED',
      });
    }
    return this.service.previewImport(merchantId, file.buffer);
  }

  /**
   * 套用：multipart file（與 preview 同內容）+ fileHash + decisions（JSON 字串）。
   * decisions: [{ row, action: skip|create|overwrite, customerId? }]
   */
  @Post('import/apply')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  applyImport(
    @Query('merchantId') merchantId: string,
    @Body('fileHash') fileHash: string,
    @Body('decisions') decisionsRaw: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file required',
        code: 'CUSTOMER_IMPORT_FILE_REQUIRED',
      });
    }
    let decisions: CustomerImportApplyDecision[];
    try {
      decisions = JSON.parse(decisionsRaw ?? '[]') as CustomerImportApplyDecision[];
      if (!Array.isArray(decisions)) {
        throw new Error('decisions must be array');
      }
    } catch {
      throw new BadRequestException({
        message: 'decisions must be JSON array',
        code: 'CUSTOMER_IMPORT_DECISIONS_INVALID',
      });
    }
    return this.service.applyImport(merchantId, file.buffer, fileHash, decisions);
  }
}
