import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

const SCHEDULE_TYPES = ['manual', 'daily', 'weekly', 'monthly'];

@Injectable()
export class DispatchRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string, enabled?: boolean) {
    const m = merchantId?.trim();
    if (!m) throw new BadRequestException({ code: 'CRM_MERCHANT_REQUIRED', message: 'merchantId is required' });
    const where: { merchantId: string; enabled?: boolean } = { merchantId: m };
    if (enabled !== undefined) where.enabled = enabled;
    return this.prisma.crmCouponDispatchRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    merchantId: string,
    body: {
      name: string;
      segmentId: string;
      couponId: string;
      enabled?: boolean;
      scheduleType: string;
      cronExpr?: string;
      nextRunAt?: string;
    },
  ) {
    const m = merchantId?.trim();
    if (!m) throw new BadRequestException({ code: 'CRM_MERCHANT_REQUIRED', message: 'merchantId is required' });
    if (!SCHEDULE_TYPES.includes(body.scheduleType)) {
      throw new BadRequestException({
        code: 'CRM_DISPATCH_SCHEDULE_INVALID',
        message: 'scheduleType must be manual, daily, weekly, or monthly',
      });
    }
    return this.prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: m,
        name: body.name.trim(),
        segmentId: body.segmentId.trim(),
        couponId: body.couponId.trim(),
        enabled: body.enabled ?? true,
        scheduleType: body.scheduleType,
        cronExpr: body.cronExpr?.trim() || null,
        nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : null,
      },
    });
  }

  async update(
    merchantId: string,
    id: string,
    body: Partial<{
      name: string;
      segmentId: string;
      couponId: string;
      enabled: boolean;
      scheduleType: string;
      cronExpr: string | null;
      nextRunAt: string | null;
    }>,
  ) {
    const m = merchantId?.trim();
    if (!m) throw new BadRequestException({ code: 'CRM_MERCHANT_REQUIRED', message: 'merchantId is required' });
    const existing = await this.prisma.crmCouponDispatchRule.findFirst({ where: { id, merchantId: m } });
    if (!existing) throw new NotFoundException({ code: 'CRM_DISPATCH_RULE_NOT_FOUND', message: 'Rule not found' });
    if (body.scheduleType != null && !SCHEDULE_TYPES.includes(body.scheduleType)) {
      throw new BadRequestException({
        code: 'CRM_DISPATCH_SCHEDULE_INVALID',
        message: 'scheduleType must be manual, daily, weekly, or monthly',
      });
    }
    return this.prisma.crmCouponDispatchRule.update({
      where: { id },
      data: {
        ...(body.name != null && { name: body.name.trim() }),
        ...(body.segmentId != null && { segmentId: body.segmentId.trim() }),
        ...(body.couponId != null && { couponId: body.couponId.trim() }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.scheduleType != null && { scheduleType: body.scheduleType }),
        ...(body.cronExpr !== undefined && { cronExpr: body.cronExpr?.trim() || null }),
        ...(body.nextRunAt !== undefined && { nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : null }),
      },
    });
  }

  async delete(merchantId: string, id: string) {
    const m = merchantId?.trim();
    if (!m) throw new BadRequestException({ code: 'CRM_MERCHANT_REQUIRED', message: 'merchantId is required' });
    const existing = await this.prisma.crmCouponDispatchRule.findFirst({ where: { id, merchantId: m } });
    if (!existing) throw new NotFoundException({ code: 'CRM_DISPATCH_RULE_NOT_FOUND', message: 'Rule not found' });
    await this.prisma.crmCouponDispatchRule.delete({ where: { id } });
    return { ok: true };
  }
}
