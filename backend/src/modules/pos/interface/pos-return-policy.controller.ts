import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PrismaService } from '../../../shared/database/prisma.service';
import { throwBadRequest, throwNotFound } from '../../../shared/utils/throw-exceptions';

@Controller('pos/return-policy')
export class PosReturnPolicyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Query('merchantId') merchantId?: string) {
    const mid = merchantId?.trim();
    if (!mid) {
      const first = await this.prisma.merchant.findFirst();
      if (!first) throwNotFound('MERCHANT_NOT_FOUND', 'No merchant found');
      return this.getOrCreate(first!.id);
    }
    return this.getOrCreate(mid);
  }

  @Patch()
  @UseGuards(AdminApiKeyGuard)
  async patch(
    @Query('merchantId') merchantId?: string,
    @Body()
    body?: {
      returnWindowDays?: number;
      exchangeWindowDays?: number;
    },
  ) {
    const mid = merchantId?.trim();
    if (!mid) {
      const first = await this.prisma.merchant.findFirst();
      if (!first) throwNotFound('MERCHANT_NOT_FOUND', 'No merchant found');
      return this.update(first!.id, body ?? {});
    }
    return this.update(mid, body ?? {});
  }

  private async getOrCreate(merchantId: string) {
    let policy = await this.prisma.returnPolicy.findUnique({
      where: { merchantId },
    });
    if (!policy) {
      policy = await this.prisma.returnPolicy.create({
        data: { merchantId },
      });
    }
    return {
      merchantId: policy.merchantId,
      returnWindowDays: policy.returnWindowDays,
      exchangeWindowDays: policy.exchangeWindowDays,
    };
  }

  private async update(
    merchantId: string,
    body: { returnWindowDays?: number; exchangeWindowDays?: number },
  ) {
    await this.getOrCreate(merchantId);

    if (
      body.returnWindowDays != null &&
      (body.returnWindowDays < 0 || body.returnWindowDays > 365)
    ) {
      throwBadRequest(
        'RETURN_POLICY_INVALID',
        'returnWindowDays must be between 0 and 365',
      );
    }
    if (
      body.exchangeWindowDays != null &&
      (body.exchangeWindowDays < 0 || body.exchangeWindowDays > 365)
    ) {
      throwBadRequest(
        'RETURN_POLICY_INVALID',
        'exchangeWindowDays must be between 0 and 365',
      );
    }

    const updated = await this.prisma.returnPolicy.update({
      where: { merchantId },
      data: {
        ...(body.returnWindowDays != null && {
          returnWindowDays: body.returnWindowDays,
        }),
        ...(body.exchangeWindowDays != null && {
          exchangeWindowDays: body.exchangeWindowDays,
        }),
      },
    });

    return {
      merchantId: updated.merchantId,
      returnWindowDays: updated.returnWindowDays,
      exchangeWindowDays: updated.exchangeWindowDays,
    };
  }
}
