import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SupplierService } from '../application/supplier.service';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly svc: SupplierService) {}

  @Get()
  list(@Query('merchantId') merchantId: string, @Query('q') q?: string) {
    return this.svc.list(merchantId, q);
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
      code: string;
      name: string;
      contactPerson?: string;
      phone?: string;
      paymentTerms?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      email?: string;
      address?: string;
      taxId?: string;
      bankAccount?: string;
      note?: string;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      code: string;
      name: string;
      contactPerson: string;
      phone: string;
      paymentTerms: string;
      status: 'ACTIVE' | 'INACTIVE';
      email: string;
      address: string;
      taxId: string;
      bankAccount: string;
      note: string;
    }>,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
