import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { throwBadRequest } from '../../../shared/utils/throw-exceptions';
import {
  CustomerService,
  type CustomerImportApplyDecision,
} from '../application/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { MergeCustomersDto } from '../dto/merge-customers.dto';

@Controller('customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  /** GET 唯讀；支援 status、tag、phone、name、memberLevel 篩選 */
  @Get()
  list(
    @Query('merchantId') merchantId: string,
    @Query('status') status?: string,
    @Query('tag') tag?: string,
    @Query('phone') phone?: string,
    @Query('name') name?: string,
    @Query('memberLevel') memberLevel?: string,
  ) {
    return this.service.listByMerchant(merchantId, {
      status,
      tag,
      phone,
      name,
      memberLevel,
    });
  }

  /** POST 合併會員（Admin）；body { primaryId, mergeIds } */
  @Post('merge')
  @UseGuards(AdminApiKeyGuard)
  merge(@Body() body: MergeCustomersDto) {
    return this.service.merge(body.primaryId.trim(), body.mergeIds);
  }

  /** GET 模糊搜尋 phone／name／memberCode，供 POS 快速選客 */
  @Get('search')
  search(
    @Query('merchantId') merchantId: string,
    @Query('q') q: string,
  ) {
    return this.service.search(merchantId, q ?? '');
  }

  /** GET 互動紀錄 */
  @Get(':id/contacts')
  getContacts(
    @Param('id') id: string,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.service.getContacts(id, merchantId);
  }

  /** POST 新增一筆互動紀錄（Admin） */
  @Post(':id/contacts')
  @UseGuards(AdminApiKeyGuard)
  addContact(
    @Param('id') id: string,
    @Body() body: { type: string; note?: string; nextFollowUpAt?: string; createdBy?: string },
    @Query('merchantId') merchantId?: string,
  ) {
    return this.service.addContact(id, body, merchantId);
  }

  /** GET 單筆詳情（含 pointBalance、expiringSoon、expiringAt、status、tags） */
  @Get(':id')
  getById(
    @Param('id') id: string,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.service.getById(id, merchantId);
  }

  /** POST 建立會員（Admin） */
  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(@Body() body: CreateCustomerDto) {
    return this.service.create(body);
  }

  /** PATCH 更新會員（Admin）；可更新 status、blockReason、tags */
  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      phone: string | null;
      email: string | null;
      memberLevel: string | null;
      code: string | null;
      memberCode: string | null;
      joinDate: string | null;
      status: string;
      blockReason: string | null;
      tags: string[];
    }>,
  ) {
    return this.service.update(id, body);
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
      throwBadRequest('CUSTOMER_IMPORT_DECISIONS_INVALID', 'decisions must be JSON array');
    }
    return this.service.applyImport(merchantId, file.buffer, fileHash, decisions);
  }
}
