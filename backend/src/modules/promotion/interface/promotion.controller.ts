import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
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
  create(
    @Body()
    body: {
      merchantId: string;
      name: string;
      priority?: number;
      draft?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      exclusive?: boolean;
      firstPurchaseOnly?: boolean;
      memberLevels?: string[];
      conditions?: unknown[];
      actions?: unknown[];
    },
  ) {
    if (!body.merchantId?.trim() || !body.name?.trim()) {
      throw new BadRequestException({
        message: 'merchantId and name required',
        code: 'PROMOTION_BODY_INVALID',
      });
    }
    return this.service.create(body.merchantId.trim(), {
      name: body.name,
      priority: body.priority,
      draft: body.draft,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      exclusive: body.exclusive,
      firstPurchaseOnly: body.firstPurchaseOnly,
      memberLevels: body.memberLevels,
      conditions: body.conditions as any,
      actions: body.actions as any,
    });
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      merchantId: string;
      name?: string;
      priority?: number;
      draft?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      exclusive?: boolean;
      firstPurchaseOnly?: boolean;
      memberLevels?: string[];
      conditions?: unknown[];
      actions?: unknown[];
    },
  ) {
    if (!body.merchantId?.trim()) {
      throw new BadRequestException({
        message: 'merchantId required',
        code: 'PROMOTION_BODY_INVALID',
      });
    }
    return this.service.update(id, body.merchantId.trim(), {
      name: body.name,
      priority: body.priority,
      draft: body.draft,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      exclusive: body.exclusive,
      firstPurchaseOnly: body.firstPurchaseOnly,
      memberLevels: body.memberLevels,
      conditions: body.conditions as any,
      actions: body.actions as any,
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
      throw new BadRequestException({
        message: 'merchantId query required',
        code: 'PROMOTION_BODY_INVALID',
      });
    }
    await this.service.remove(id, merchantId.trim());
  }
}
