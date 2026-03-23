import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PosHeldCartsService } from '../application/pos-held-carts.service';
import {
  IsString,
  IsArray,
  IsNumber,
  IsInt,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class HeldCartItemDto {
  @IsString()
  productId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class HoldCartBodyDto {
  @IsString()
  storeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HeldCartItemDto)
  items!: HeldCartItemDto[];
}

@Controller('pos/held-carts')
export class PosHeldCartsController {
  constructor(private readonly service: PosHeldCartsService) {}

  @Post()
  @UseGuards(AdminApiKeyGuard)
  hold(@Body() body: HoldCartBodyDto) {
    const items = Array.isArray(body?.items) ? body.items : [];
    return this.service.holdCart({
      storeId: body?.storeId ?? '',
      items: items.map((i) => ({
        productId: String(i?.productId ?? ''),
        name: String(i?.name ?? ''),
        unitPrice: Number(i?.unitPrice) || 0,
        quantity: Number(i?.quantity) || 0,
      })),
    });
  }

  @Get()
  list(@Query('storeId') storeId?: string) {
    return this.service.listHeldCarts(storeId ?? '');
  }

  @Post(':id/retrieve')
  @UseGuards(AdminApiKeyGuard)
  retrieve(@Param('id') id: string) {
    return this.service.retrieveAndDelete(id);
  }
}
