import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PosHeldCartsService } from '../application/pos-held-carts.service';

class HeldCartItemDto {
  productId!: string;
  name!: string;
  unitPrice!: number;
  quantity!: number;
}

class HoldCartBodyDto {
  storeId!: string;
  items!: HeldCartItemDto[];
}

@Controller('pos/held-carts')
export class PosHeldCartsController {
  constructor(private readonly service: PosHeldCartsService) {}

  @Post()
  @UseGuards(AdminApiKeyGuard)
  hold(@Body() body: HoldCartBodyDto) {
    return this.service.holdCart({
      storeId: body.storeId,
      items: body.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: Number(i.unitPrice),
        quantity: Number(i.quantity),
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
