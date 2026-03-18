import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { DispatchRuleRunnerService } from '../../crm/application/dispatch-rule-runner.service';
import { FinanceService } from '../../finance/application/finance.service';
import { Prisma } from '@prisma/client';

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
  async recordRun(jobType: string, success: boolean, message?: string | null): Promise<{ id: string }> {
    const row = await this.prisma.opsJobRunLog.create({
      data: {
        jobType,
        success,
        message: message?.slice(0, 2000) ?? null,
      },
    });
    return { id: row.id };
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
    resultCode?: string;
  }): Promise<{ id: string; resolvedKind: 'posOrder' | 'receivingNote' | 'unknown'; success: boolean; createdAt: string }> {
    const source = params.source?.trim();
    const referenceId = params.referenceId ?? '';
    if (!source) {
      throw new BadRequestException({ code: 'OPS_REPORT_CLICK_AUDIT_INVALID', message: 'source is required' });
    }
    const field = params.field?.trim() || 'referenceId';
    const resolved = await this.resolveReference(referenceId);
    const success = resolved.kind !== 'unknown';
    const resultCode =
      params.resultCode?.trim() ||
      (success ? 'NAVIGATED' : 'NOT_FOUND');
    const row = await this.prisma.reportClickAudit.create({
      data: {
        merchantId: params.merchantId?.trim() || null,
        source,
        field,
        referenceId: referenceId ?? '',
        resultCode,
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

  private parseOptionalBool(s?: string): boolean | undefined {
    if (s == null) return undefined;
    const v = s.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return undefined;
  }

  private parseRange(fromStr?: string, toStr?: string): { from?: Date; to?: Date } {
    const fromS = fromStr?.trim();
    const toS = toStr?.trim();
    const from = fromS ? new Date(fromS) : undefined;
    const to = toS ? new Date(toS) : undefined;
    if (fromS && (!from || Number.isNaN(from.getTime()))) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'invalid from/to' });
    }
    if (toS && (!to || Number.isNaN(to.getTime()))) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'invalid from/to' });
    }
    if (from && to && from > to) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'from must be <= to' });
    }
    return { from, to };
  }

  private fixHintFromResultCode(resultCode: string | null | undefined): 'DATA_MISSING' | 'NEEDS_DISAMBIGUATION' | 'PERMISSION' | 'OK' {
    const code = resultCode?.trim() || '';
    if (code === 'NAVIGATED') return 'OK';
    if (code === 'PERMISSION') return 'PERMISSION';
    if (code === 'MULTI_MATCH') return 'NEEDS_DISAMBIGUATION';
    return 'DATA_MISSING';
  }

  async listReportClickAudit(q: {
    from?: string;
    to?: string;
    source?: string;
    resolvedKind?: string;
    resultCode?: string;
    success?: string;
    referenceId?: string;
    page?: number;
    pageSize?: number;
    sort?: 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<{
    items: Array<{
      id: string;
      merchantId: string | null;
      source: string;
      field: string;
      referenceId: string;
      resultCode: string | null;
      fixHint: 'DATA_MISSING' | 'NEEDS_DISAMBIGUATION' | 'PERMISSION' | 'OK';
      resolvedKind: string;
      success: boolean;
      createdAt: string;
    }>;
    page: number;
    pageSize: number;
    total: number;
  }> {
    const { from, to } = this.parseRange(q.from, q.to);
    const page = q.page && q.page > 0 ? q.page : 1;
    const pageSize = q.pageSize && q.pageSize > 0 ? Math.min(q.pageSize, 200) : 50;
    const where: Prisma.ReportClickAuditWhereInput = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q.source?.trim()) where.source = q.source.trim();
    if (q.resolvedKind?.trim()) where.resolvedKind = q.resolvedKind.trim();
    if (q.resultCode?.trim()) (where as any).resultCode = q.resultCode.trim();
    const ok = this.parseOptionalBool(q.success);
    if (ok !== undefined) where.success = ok;
    if (q.referenceId?.trim()) where.referenceId = q.referenceId.trim();

    const orderBy: { createdAt: 'asc' | 'desc' } = { createdAt: q.order === 'asc' ? 'asc' : 'desc' };
    const [rows, total] = await Promise.all([
      this.prisma.reportClickAudit.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reportClickAudit.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        source: r.source,
        field: r.field,
        referenceId: r.referenceId,
        resultCode: (r as any).resultCode ?? null,
        fixHint: this.fixHintFromResultCode(((r as any).resultCode ?? null) as any),
        resolvedKind: r.resolvedKind,
        success: r.success,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }

  async summaryReportClickAudit(q: {
    from?: string;
    to?: string;
    source?: string;
    resolvedKind?: string;
    success?: string;
    days?: number;
    top?: number;
  }): Promise<{
    total: number;
    bySuccess: { success: boolean; count: number }[];
    bySource: { source: string; count: number }[];
    byResultCode: { resultCode: string | null; count: number }[];
    byResolvedKind: { resolvedKind: string; count: number }[];
    topSources: { source: string; notFound: number; multiMatch: number; total: number }[];
    trendByDay: { day: string; total: number; failed: number }[];
    topReferenceIds: { field: string; referenceId: string; count: number }[];
    health: {
      notFoundRate: number;
      multiMatchRate: number;
      navigatedRate: number;
      status: 'OK' | 'WARN' | 'ALERT';
      thresholds: {
        warnNotFoundRate: number;
        alertNotFoundRate: number;
        warnMultiMatchRate: number;
        alertMultiMatchRate: number;
      };
    };
    fixHints: { fixHint: 'DATA_MISSING' | 'NEEDS_DISAMBIGUATION' | 'PERMISSION' | 'OK'; count: number }[];
  }> {
    const { from, to } = this.parseRange(q.from, q.to);
    const where: Prisma.ReportClickAuditWhereInput = {};
    const top = q.top && q.top > 0 ? Math.min(q.top, 200) : 20;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q.source?.trim()) where.source = q.source.trim();
    if (q.resolvedKind?.trim()) where.resolvedKind = q.resolvedKind.trim();
    const ok = this.parseOptionalBool(q.success);
    if (ok !== undefined) where.success = ok;

    // When from/to not specified, allow quick "recent N days" trend view.
    const days = q.days && q.days > 0 ? Math.min(q.days, 180) : 14;
    const trendFrom = !from && !to ? new Date(Date.now() - (days - 1) * 24 * 3600 * 1000) : undefined;

    const [total, bySuccessRows, bySourceRows, byResultCodeRows, byKindRows, topSourcesRows, trendRows, topRefRows] =
      await Promise.all([
        this.prisma.reportClickAudit.count({ where }),
        this.prisma.reportClickAudit.groupBy({ by: ['success'], where, _count: { _all: true } }),
        this.prisma.reportClickAudit.groupBy({ by: ['source'], where, _count: { _all: true } }),
        this.prisma.reportClickAudit.groupBy({ by: ['resultCode'], where, _count: { _all: true } } as any),
        this.prisma.reportClickAudit.groupBy({ by: ['resolvedKind'], where, _count: { _all: true } }),
        // topSources: rank sources by NOT_FOUND/MULTI_MATCH frequency (within current filters)
        this.prisma.reportClickAudit.groupBy({
          by: ['source', 'resultCode'],
          where: {
            ...where,
            resultCode: { in: ['NOT_FOUND', 'MULTI_MATCH'] } as any,
          } as any,
          _count: { _all: true },
        } as any),
        // trendByDay: recent N days (or within from/to if specified)
        (async () => {
          // Don't read where.createdAt (union type); use parsed from/to directly.
          const gte = from ?? trendFrom;
          const lte = to;
          const whereSql = Prisma.sql`
            WHERE 1=1
            ${gte ? Prisma.sql`AND "createdAt" >= ${gte}` : Prisma.empty}
            ${lte ? Prisma.sql`AND "createdAt" <= ${lte}` : Prisma.empty}
            ${where.source ? Prisma.sql`AND "source" = ${where.source}` : Prisma.empty}
            ${where.resolvedKind ? Prisma.sql`AND "resolvedKind" = ${where.resolvedKind}` : Prisma.empty}
            ${where.success !== undefined ? Prisma.sql`AND "success" = ${where.success}` : Prisma.empty}
          `;
          const rows = (await this.prisma.$queryRaw(Prisma.sql`
            SELECT
              to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day,
              COUNT(*)::int as total,
              SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END)::int as failed
            FROM "ReportClickAudit"
            ${whereSql}
            GROUP BY 1
            ORDER BY 1 ASC
          `)) as Array<{ day: string; total: number; failed: number }>;
          return rows;
        })(),
        // topReferenceIds: most frequent failed referenceId/field (within current filters)
        (async () => {
          const whereSql = Prisma.sql`
            WHERE 1=1
            ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
            ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
            ${where.source ? Prisma.sql`AND "source" = ${where.source}` : Prisma.empty}
            ${where.resolvedKind ? Prisma.sql`AND "resolvedKind" = ${where.resolvedKind}` : Prisma.empty}
            AND "success" = false
          `;
          const rows = (await this.prisma.$queryRaw(Prisma.sql`
            SELECT
              "field" as field,
              "referenceId" as "referenceId",
              COUNT(*)::int as count
            FROM "ReportClickAudit"
            ${whereSql}
            GROUP BY 1, 2
            ORDER BY 3 DESC
            LIMIT ${top}
          `)) as Array<{ field: string; referenceId: string; count: number }>;
          return rows;
        })(),
      ]);

    const topSourcesMap = new Map<string, { source: string; notFound: number; multiMatch: number; total: number }>();
    for (const r of topSourcesRows as any[]) {
      const source = r.source as string;
      const resultCode = (r as any).resultCode as string | null;
      const count = (r as any)._count?._all ?? 0;
      const cur = topSourcesMap.get(source) ?? { source, notFound: 0, multiMatch: 0, total: 0 };
      if (resultCode === 'NOT_FOUND') cur.notFound += count;
      if (resultCode === 'MULTI_MATCH') cur.multiMatch += count;
      cur.total = cur.notFound + cur.multiMatch;
      topSourcesMap.set(source, cur);
    }
    const topSources = [...topSourcesMap.values()].sort((a, b) => b.total - a.total).slice(0, top);

    const byResultCode = (byResultCodeRows as any[]).map((r) => ({ resultCode: r.resultCode ?? null, count: r._count._all })) as Array<{
      resultCode: string | null;
      count: number;
    }>;
    const notFound = byResultCode.find((x) => x.resultCode === 'NOT_FOUND')?.count ?? 0;
    const multiMatch = byResultCode.find((x) => x.resultCode === 'MULTI_MATCH')?.count ?? 0;
    const navigated = byResultCode.find((x) => x.resultCode === 'NAVIGATED')?.count ?? 0;
    const denom = total > 0 ? total : 1;
    const notFoundRate = notFound / denom;
    const multiMatchRate = multiMatch / denom;
    const navigatedRate = navigated / denom;
    const thresholds = {
      warnNotFoundRate: 0.2,
      alertNotFoundRate: 0.5,
      warnMultiMatchRate: 0.05,
      alertMultiMatchRate: 0.2,
    };
    const status: 'OK' | 'WARN' | 'ALERT' =
      notFoundRate >= thresholds.alertNotFoundRate || multiMatchRate >= thresholds.alertMultiMatchRate
        ? 'ALERT'
        : notFoundRate >= thresholds.warnNotFoundRate || multiMatchRate >= thresholds.warnMultiMatchRate
          ? 'WARN'
          : 'OK';

    const fixHints = [
      { fixHint: 'DATA_MISSING' as const, count: notFound },
      { fixHint: 'NEEDS_DISAMBIGUATION' as const, count: multiMatch },
      { fixHint: 'PERMISSION' as const, count: byResultCode.find((x) => x.resultCode === 'PERMISSION')?.count ?? 0 },
      { fixHint: 'OK' as const, count: navigated },
    ];

    return {
      total,
      bySuccess: bySuccessRows.map((r) => ({ success: r.success, count: r._count._all })),
      bySource: bySourceRows.map((r) => ({ source: r.source, count: r._count._all })),
      byResultCode,
      byResolvedKind: byKindRows.map((r) => ({ resolvedKind: r.resolvedKind, count: r._count._all })),
      topSources,
      trendByDay: trendRows,
      topReferenceIds: topRefRows as any,
      health: {
        notFoundRate,
        multiMatchRate,
        navigatedRate,
        status,
        thresholds,
      },
      fixHints,
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
        const runLog = await this.recordRun(kind, result.errors.length === 0, result.errors.length ? result.errors.join('; ') : undefined);
        return { ok: true, kind, runLogId: runLog.id, result };
      } catch (e) {
        const runLog = await this.recordRun(kind, false, (e as Error).message);
        (e as { runLogId?: string }).runLogId = runLog.id;
        throw e;
      }
    }
    if (kind === 'finance-snapshot') {
      const asOfDate = body.asOfDate?.trim() || new Date().toISOString().slice(0, 10);
      const snapshotType = body.snapshotType === 'monthly' ? 'monthly' : 'daily';
      try {
        const result = await this.finance.createSnapshot({ asOfDate, type: snapshotType });
        const runLog = await this.recordRun(kind, true);
        return { ok: true, kind, runLogId: runLog.id, result };
      } catch (e) {
        const runLog = await this.recordRun(kind, false, (e as Error).message);
        (e as { runLogId?: string }).runLogId = runLog.id;
        throw e;
      }
    }
    throw new BadRequestException({ code: 'OPS_JOB_KIND_INVALID', message: 'Unsupported kind' });
  }
}
