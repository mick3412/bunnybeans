import { Controller, Get, Query } from '@nestjs/common';
import { throwBadRequest } from '../../../shared/utils/throw-exceptions';
import { PosService } from '../application/pos.service';

@Controller('pos/products')
export class PosProductsController {
  constructor(private readonly service: PosService) {}

  /**
   * 取得 POS 收銀區產品列表，含門市對應倉庫之庫存數量。
   * 需帶 storeId 以解析該門市所屬倉庫並彙總 onHandQty。
   */
  @Get()
  list(
    @Query('storeId') storeId?: string,
  ) {
    const id = storeId?.trim();
    if (!id) {
      throwBadRequest('POS_PRODUCTS_STORE_REQUIRED', 'storeId is required');
    }
    return this.service.listProductsWithInventory(id);
  }
}
