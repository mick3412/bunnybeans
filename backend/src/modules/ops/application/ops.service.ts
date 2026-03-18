import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { DispatchRuleRunnerService } from '../../crm/application/dispatch-rule-runner.service';
import { FinanceService } from '../../finance/application/finance.service';

export const OPS_JOB_TYPES = ['crm-run-scheduled', 'finance-period-close', 'finance-snapshot'] as const;

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DispatchRuleRunnerService))
    private readonly dispatchRuleRunner: DispatchRuleRunnerService,
    @Inject(forwardRef(() => FinanceService))
    private readonly finance: FinanceService,
  ) {}

  private summarizeMessage(message: string | null): string | null {
    if (!message) return message;
    // 換行與多空白統一成單一空白，避免列表顯示破版
    const normalized = message.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.length > 200 ? normalized.slice(0, 200) + '…' : normalized;
  }

  /** 紀錄定時 job 執行結果；供 run-scheduled／關帳／快照等呼叫 */
  async recordRun(jobType: string, success: boolean, message?: string | null): Promise<void> {
    await this.prisma.opsJobRunLog.create({
      data: {
        jobType,
        success,
        message: message?.slice(0, 2000) ?? null,
      },
    });
  }

  /** OpsJobRunLog 列表：分頁、kind 篩選 */
  async listJobs(params: {
    page?: number;
    pageSize?: number;
    kind?: string;
    from?: string;
    to?: string;
  }): Promise<{ items: Array<{ id: string; jobType: string; lastRunAt: string; success: boolean; message: string | null; messageSummary: string | null; createdAt: string }>; total: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;
    const where: { jobType?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
    if (params.kind?.trim()) where.jobType = params.kind.trim();
    const fromStr = params.from?.trim();
    const toStr = params.to?.trim();
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    if (fromStr && (!from || Number.isNaN(from.getTime()))) {
      throw new BadRequestException({
        code: 'REPORT_INVALID_RANGE',
        message: 'invalid from/to',
      });
    }
    if (toStr && (!to || Number.isNaN(to.getTime()))) {
      throw new BadRequestException({
        code: 'REPORT_INVALID_RANGE',
        message: 'invalid from/to',
      });
    }
    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'REPORT_INVALID_RANGE',
        message: 'from must be <= to',
      });
    }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.opsJobRunLog.findMany({
        where,
        orderBy: { lastRunAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.opsJobRunLog.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        jobType: r.jobType,
        lastRunAt: r.lastRunAt.toISOString(),
        success: r.success,
        message: r.message,
        messageSummary: this.summarizeMessage(r.message),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** 查詢各 job 類型最近一次執行紀錄（供 GET /ops/jobs/status） */
  async getStatus(): Promise<{ items: { jobType: string; lastRunAt: string | null; success: boolean; message: string | null }[] }> {
    const jobTypes = [...OPS_JOB_TYPES];
    const items = await Promise.all(
      jobTypes.map(async (jobType) => {
        const last = await this.prisma.opsJobRunLog.findFirst({
          where: { jobType },
          orderBy: { lastRunAt: 'desc' },
        });
        return last
          ? { jobType, lastRunAt: last.lastRunAt.toISOString(), success: last.success, message: last.message }
          : { jobType, lastRunAt: null, success: true, message: null };
      }),
    );
    return { items };
  }

  async resolveReference(referenceId: string): Promise<{
    referenceId: string;
    kind: 'posOrder' | 'receivingNote' | 'unknown';
  }> {
    const id = referenceId.trim();
    if (!id) return { referenceId: '', kind: 'unknown' };
    const pos = await this.prisma.posOrder.findUnique({ where: { id }, select: { id: true } });
    if (pos) return { referenceId: id, kind: 'posOrder' };
    const rn = await this.prisma.receivingNote.findUnique({ where: { id }, select: { id: true } });
    if (rn) return { referenceId: id, kind: 'receivingNote' };
    return { referenceId: id, kind: 'unknown' };
  }

  /**
   * 報表穿透點擊審計：記錄 source/field/referenceId，以及 resolve 的 kind 與是否成功。
   * success 定義：resolvedKind !== 'unknown'
   */
  async recordReportClickAudit(params: {
    merchantId?: string;
    source: string;
    field?: string;
    referenceId: string;
  }): Promise<{ id: string; resolvedKind: 'posOrder' | 'receivingNote' | 'unknown'; success: boolean; createdAt: string }> {
    const source = params.source?.trim();
    const referenceId = params.referenceId ?? '';
    if (!source) {
      throw new BadRequestException({ code: 'OPS_REPORT_CLICK_AUDIT_INVALID', message: 'source is required' });
    }
    const field = params.field?.trim() || 'referenceId';
    const resolved = await this.resolveReference(referenceId);
    const success = resolved.kind !== 'unknown';
    const row = await this.prisma.reportClickAudit.create({
      data: {
        merchantId: params.merchantId?.trim() || null,
        source,
        field,
        referenceId: referenceId ?? '',
        resolvedKind: resolved.kind,
        success,
      },
    });
    return {
      id: row.id,
      resolvedKind: resolved.kind,
      success,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * 手動補跑（Admin）：統一入口觸發部分 job。
   * 目前支援：crm-run-scheduled、finance-snapshot（daily/monthly）。
   */
  async runJob(body: {
    kind: typeof OPS_JOB_TYPES[number];
    asOfDate?: string;
    snapshotType?: 'daily' | 'monthly';
  }) {
    const kind = body.kind;
    if (kind === 'crm-run-scheduled') {
      try {
        const result = await this.dispatchRuleRunner.runScheduled();
        await this.recordRun(kind, result.errors.length === 0, result.errors.length ? result.errors.join('; ') : undefined);
        return { ok: true, kind, result };
      } catch (e) {
        await this.recordRun(kind, false, (e as Error).message);
        throw e;
      }
    }
    if (kind === 'finance-snapshot') {
      const asOfDate = body.asOfDate?.trim() || new Date().toISOString().slice(0, 10);
      const snapshotType = body.snapshotType === 'monthly' ? 'monthly' : 'daily';
      try {
        const result = await this.finance.createSnapshot({ asOfDate, type: snapshotType });
        await this.recordRun(kind, true);
        return { ok: true, kind, result };
      } catch (e) {
        await this.recordRun(kind, false, (e as Error).message);
        throw e;
      }
    }
    throw new BadRequestException({ code: 'OPS_JOB_KIND_INVALID', message: 'Unsupported kind' });
  }
}
