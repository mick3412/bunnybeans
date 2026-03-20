import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { CreatePromotionRuleDto } from '../dto/create-promotion-rule.dto';
import { UpdatePromotionRuleDto } from '../dto/update-promotion-rule.dto';
import { throwBadRequest } from '../../../shared/utils/throw-exceptions';
import { PromotionService } from '../application/promotion.service';

@Controller('promotion-rules')
export class PromotionController {
  constructor(private readonly service: PromotionService) {}

  @Get()
  list(
    @Query('merchantId') merchantId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    if (!merchantId?.trim()) {
      return [];
    }
    return this.service.list(merchantId.trim(), { status, q });
  }

  @Get('effectiveness')
  getEffectiveness(
    @Query('merchantId') merchantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
  ) {
    if (!merchantId?.trim()) {
      throwBadRequest('PROMOTION_BODY_INVALID', 'merchantId is required');
    }
    return this.service.getEffectiveness(merchantId.trim(), {
      from,
      to,
      preset,
    });
  }

  @Patch('reorder/bulk')
  @UseGuards(AdminApiKeyGuard)
  reorderBulk(
    @Body() body: { merchantId: string; ids: string[] },
  ) {
    return this.service.reorder(body.merchantId?.trim() ?? '', body.ids ?? []);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(@Body() body: CreatePromotionRuleDto) {
    return this.service.create(body.merchantId.trim(), {
      name: body.name,
      priority: body.priority,
      draft: body.draft,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      exclusive: body.exclusive,
      firstPurchaseOnly: body.firstPurchaseOnly,
      memberLevels: body.memberLevels,
      conditions: body.conditions ?? [],
      actions: body.actions ?? [],
    });
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(@Param('id') id: string, @Body() body: UpdatePromotionRuleDto) {
    return this.service.update(id, body.merchantId.trim(), {
      name: body.name,
      priority: body.priority,
      draft: body.draft,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      exclusive: body.exclusive,
      firstPurchaseOnly: body.firstPurchaseOnly,
      memberLevels: body.memberLevels,
      conditions: body.conditions ?? [],
      actions: body.actions ?? [],
    });
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
  ) {
    if (!merchantId?.trim()) {
      throwBadRequest('PROMOTION_BODY_INVALID', 'merchantId query required');
    }
    await this.service.remove(id, merchantId.trim());
  }
}
