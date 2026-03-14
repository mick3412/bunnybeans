import { Body, Controller, Post } from '@nestjs/common';
import { PromotionService } from '../../promotion/application/promotion.service';

@Controller('pos/promotions')
export class PosPromotionsController {
  constructor(private readonly promotion: PromotionService) {}

  @Post('preview')
  preview(
    @Body()
    body: {
      storeId: string;
      customerId?: string | null;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    },
  ) {
    return this.promotion.preview({
      storeId: body.storeId,
      customerId: body.customerId,
      items: body.items ?? [],
    });
  }
}
