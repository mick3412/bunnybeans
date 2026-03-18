import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CrmJobService } from './crm-job.service';

@Injectable()
export class DispatchRuleRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmJobService: CrmJobService,
  ) {}

  /**
   * 掃描 enabled=true 且 nextRunAt <= now（或 null）的發券規則，依序觸發 segment-coupon job 並更新 nextRunAt。
   * 可由 cron 或 POST /crm/jobs/run-scheduled 呼叫。
   */
  async runScheduled(): Promise<{ triggered: number; errors: string[] }> {
    const now = new Date();
    const rules = await this.prisma.crmCouponDispatchRule.findMany({
      where: {
        enabled: true,
        scheduleType: { in: ['daily', 'weekly', 'monthly'] },
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      orderBy: { nextRunAt: 'asc' },
    });

    let triggered = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        const job = await this.crmJobService.createJob('segment-coupon', {
          merchantId: rule.merchantId,
          segmentId: rule.segmentId,
          couponId: rule.couponId,
        });
        triggered += 1;

        const next = this.computeNextRunAt(now, rule.scheduleType);
        await this.prisma.crmCouponDispatchRule.update({
          where: { id: rule.id },
          data: {
            nextRunAt: next,
            lastRunAt: now,
            lastRunCode: 'SENT',
            lastRunNote: `jobId=${job.jobId}`,
          },
        });
      } catch (e) {
        const err = this.formatError(e);
        errors.push(`${rule.id}: ${err}`);
        await this.prisma.crmCouponDispatchRule.update({
          where: { id: rule.id },
          data: {
            lastRunAt: now,
            lastRunCode: 'FAILED',
            lastRunNote: err.slice(0, 500),
          },
        });
      }
    }

    return { triggered, errors };
  }

  private formatError(e: unknown): string {
    const anyE = e as any;
    const res = anyE?.response;
    const code = typeof res?.code === 'string' ? res.code : undefined;
    const msg = typeof res?.message === 'string' ? res.message : undefined;
    if (code && msg) return `${code} ${msg}`;
    if (code) return code;
    if (typeof anyE?.message === 'string' && anyE.message.trim()) return anyE.message;
    try {
      return JSON.stringify(res ?? anyE);
    } catch {
      return 'unknown error';
    }
  }

  private computeNextRunAt(after: Date, scheduleType: string): Date {
    const next = new Date(after);
    switch (scheduleType) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        return next;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        return next;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        return next;
      default:
        next.setDate(next.getDate() + 1);
        return next;
    }
  }
}
