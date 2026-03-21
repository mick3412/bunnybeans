import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CrmJobService } from './crm-job.service';

@Injectable()
export class DispatchRuleRunnerService {
  private readonly logger = new Logger(DispatchRuleRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmJobService: CrmJobService,
  ) {}

  /**
   * 掃描 enabled=true 且 nextRunAt <= now（或 null）的發券規則，依序觸發 segment-coupon job 並更新 nextRunAt。
   * 可由 cron 或 POST /crm/jobs/run-scheduled 呼叫。
   */
  async runScheduled(): Promise<{
    triggered: number;
    errors: string[];
    updatedRules: Array<{
      ruleId: string;
      ruleName: string;
      lastRunCode: 'SENT' | 'SKIPPED' | 'FAILED';
      lastRunNote: string | null;
    }>;
    message: string | null;
  }> {
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
    const updatedRules: Array<{
      ruleId: string;
      ruleName: string;
      lastRunCode: 'SENT' | 'SKIPPED' | 'FAILED';
      lastRunNote: string | null;
    }> = [];

    for (const rule of rules) {
      try {
        // duplicate protection: if already ran within the same period, skip issuing again
        if (rule.lastRunAt && this.isSamePeriod(rule.lastRunAt, now, rule.scheduleType)) {
          const next = this.computeNextRunAt(now, rule.scheduleType);
          await this.prisma.crmCouponDispatchRule.update({
            where: { id: rule.id },
            data: {
              nextRunAt: next,
              lastRunAt: now,
              lastRunCode: 'SKIPPED',
              lastRunNote: 'duplicate-protection: already ran in this period',
            },
          });
          updatedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            lastRunCode: 'SKIPPED',
            lastRunNote: 'duplicate-protection: already ran in this period',
          });
          continue;
        }

        const job = await this.crmJobService.createJob('segment-coupon', {
          merchantId: rule.merchantId,
          segmentId: rule.segmentId,
          couponId: rule.couponId,
        });
        triggered += 1;

        const next = this.computeNextRunAt(now, rule.scheduleType);
        const note = `jobId=${job.jobId}`;
        await this.prisma.crmCouponDispatchRule.update({
          where: { id: rule.id },
          data: {
            nextRunAt: next,
            lastRunAt: now,
            lastRunCode: 'SENT',
            lastRunNote: note,
          },
        });
        updatedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          lastRunCode: 'SENT',
          lastRunNote: note,
        });
      } catch (e) {
        const err = this.formatError(e);
        errors.push(`${rule.id}: ${err}`);
        const note = err.slice(0, 500);
        const retryAt = new Date(now.getTime() + 30 * 60 * 1000);
        // Be tolerant: rule might be deleted concurrently (tests/ops), don't fail the whole runner.
        await this.prisma.crmCouponDispatchRule.updateMany({
          where: { id: rule.id },
          data: {
            nextRunAt: retryAt,
            lastRunAt: now,
            lastRunCode: 'FAILED',
            lastRunNote: note,
          },
        });
        updatedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          lastRunCode: 'FAILED',
          lastRunNote: note,
        });
      }
    }

    const failedCount = updatedRules.filter((r) => r.lastRunCode === 'FAILED').length;
    const skippedCount = updatedRules.filter((r) => r.lastRunCode === 'SKIPPED').length;
    const sentCount = updatedRules.filter((r) => r.lastRunCode === 'SENT').length;
    const preview = updatedRules
      .slice(0, 8)
      .map((r) => `${r.ruleName}[${r.lastRunCode}]:${r.lastRunNote ?? ''}`.slice(0, 180));
    const message =
      preview.length > 0 ? `dispatch-rules updated: triggered=${sentCount}, skipped=${skippedCount}, failed=${failedCount}; ${preview.join(' | ')}` : null;

    return { triggered, errors, updatedRules, message };
  }

  private formatError(e: unknown): string {
    const err = e as Record<string, unknown> | null;
    const res = err?.response as Record<string, unknown> | undefined;
    const code = typeof res?.code === 'string' ? res.code : undefined;
    const msg = typeof res?.message === 'string' ? res.message : undefined;
    if (code && msg) return `${code} ${msg}`;
    if (code) return code;
    if (e instanceof Error && e.message.trim()) return e.message;
    try {
      return JSON.stringify(res ?? err);
    } catch (inner) {
      this.logger.warn(`formatError JSON.stringify failed: ${inner instanceof Error ? inner.message : String(inner)}`);
      return 'unknown error';
    }
  }

  private isSamePeriod(a: Date, b: Date, scheduleType: string): boolean {
    const da = new Date(a);
    const db = new Date(b);
    if (scheduleType === 'daily') {
      return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth() && da.getUTCDate() === db.getUTCDate();
    }
    if (scheduleType === 'monthly') {
      return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
    }
    // weekly (ISO-ish using UTC week number)
    const weekKey = (d: Date) => {
      const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${date.getUTCFullYear()}-${week}`;
    };
    return weekKey(da) === weekKey(db);
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
