import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoyaltyService } from '../application/loyalty.service';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('settings')
  async getSettings(@Query('merchantId') merchantId: string) {
    if (!merchantId?.trim()) {
      return { error: { code: 'VALIDATION_ERROR', message: 'merchantId required' } };
    }
    return this.loyalty.getSettings(merchantId.trim());
  }

  @Patch('settings')
  @UseGuards(AdminApiKeyGuard)
  async patchSettings(
    @Query('merchantId') merchantId: string,
    @Body()
    body: Partial<{
      earnPerNT: number;
      pointValueNT: number;
      birthdayMultiplier: number;
      rollingDays: number;
      notifyDaysBefore: number;
    }>,
  ) {
    if (!merchantId?.trim()) {
      return { error: { code: 'VALIDATION_ERROR', message: 'merchantId required' } };
    }
    return this.loyalty.patchSettings(merchantId.trim(), body);
  }

  @Get('point-ledger')
  async pointLedger(
    @Query('merchantId') merchantId: string,
    @Query('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerBody(merchantId, customerId, limit);
  }

  @Get('ledger')
  async ledger(
    @Query('merchantId') merchantId: string,
    @Query('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerBody(merchantId, customerId, limit);
  }

  private async ledgerBody(
    merchantId: string,
    customerId: string | undefined,
    limit?: string,
  ) {
    if (!merchantId?.trim()) {
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'merchantId required',
        },
      };
    }
    const lim = limit ? parseInt(limit, 10) || 50 : 50;
    if (!customerId?.trim()) {
      const rows = await this.loyalty.listLedgerMerchantWide(merchantId.trim(), lim);
      return {
        items: rows.map((r) => ({
          id: r.id,
          customerId: r.customerId,
          customerName: r.customer.name,
          type: r.type,
          amount: r.amount,
          balanceAfter: r.balanceAfter,
          txnCode: r.txnCode,
          referenceId: r.referenceId,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
    const rows = await this.loyalty.listLedger(
      merchantId.trim(),
      customerId.trim(),
      lim,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        txnCode: r.txnCode,
        referenceId: r.referenceId,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  @Get('dashboard')
  async dashboard(@Query('merchantId') merchantId: string) {
    if (!merchantId?.trim()) {
      return { error: { code: 'VALIDATION_ERROR', message: 'merchantId required' } };
    }
    return this.loyalty.dashboard(merchantId.trim());
  }

  @Get('coupons')
  async listCoupons(@Query('merchantId') merchantId: string) {
    if (!merchantId?.trim()) {
      return { error: { code: 'VALIDATION_ERROR', message: 'merchantId required' } };
    }
    const rows = await this.loyalty.listCoupons(merchantId.trim());
    return {
      items: rows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        discountType: c.discountType,
        value: Number(c.value),
        validFrom: c.validFrom?.toISOString() ?? null,
        validTo: c.validTo?.toISOString() ?? null,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        active: c.active,
      })),
    };
  }

  @Post('coupons')
  @UseGuards(AdminApiKeyGuard)
  async createCoupon(
    @Query('merchantId') merchantId: string,
    @Body()
    body: {
      code: string;
      name: string;
      discountType: string;
      value: number;
      validFrom?: string;
      validTo?: string;
      maxUses?: number;
      active?: boolean;
    },
  ) {
    if (!merchantId?.trim() || !body?.code || !body?.name) {
      return {
        error: { code: 'VALIDATION_ERROR', message: 'merchantId, code, name required' },
      };
    }
    try {
      const c = await this.loyalty.createCoupon(merchantId.trim(), body);
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        discountType: c.discountType,
        value: Number(c.value),
      };
    } catch {
      return { error: { code: 'LOYALTY_COUPON_DUPLICATE', message: 'code exists' } };
    }
  }

  @Patch('coupons/:id')
  @UseGuards(AdminApiKeyGuard)
  async updateCoupon(
    @Query('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      value: number;
      validFrom: string | null;
      validTo: string | null;
      maxUses: number | null;
      active: boolean;
    }>,
  ) {
    if (!merchantId?.trim()) {
      return { error: { code: 'VALIDATION_ERROR', message: 'merchantId required' } };
    }
    try {
      const c = await this.loyalty.updateCoupon(merchantId.trim(), id, body);
      return { id: c.id, code: c.code, name: c.name, active: c.active };
    } catch {
      return { error: { code: 'NOT_FOUND', message: 'coupon' } };
    }
  }

  @Get('reports/activity')
  @UseGuards(AdminApiKeyGuard)
  async reportsActivity(
    @Query('merchantId') merchantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.loyalty.getReportsActivity(merchantId?.trim() ?? '', { from, to, preset, groupBy });
  }

  @Get('reports/members')
  @UseGuards(AdminApiKeyGuard)
  async reportsMembers(
    @Query('merchantId') merchantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
  ) {
    return this.loyalty.getReportsMembers(merchantId?.trim() ?? '', { from, to, preset });
  }
}
