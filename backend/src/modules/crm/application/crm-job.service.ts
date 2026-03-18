import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SegmentService } from './segment.service';

const ALLOWED_KINDS = ['segment-coupon', 'birthday-coupon', 'repurchase-coupon'];

type JobResultOk = { sent: number; skipped: number; errors?: string[] };

@Injectable()
export class CrmJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly segmentService: SegmentService,
  ) {}

  /**
   * POST /crm/jobs/:kind — 建立分群發券 job，202 { jobId }；非同步執行
   * body: merchantId（必填）、segmentId（必填）、couponId 或 couponCode（必填其一）
   */
  async createJob(
    kind: string,
    body: { merchantId?: string; segmentId?: string; couponId?: string; couponCode?: string },
  ): Promise<{ jobId: string }> {
    if (!ALLOWED_KINDS.includes(kind)) {
      throw new BadRequestException({
        code: 'CRM_JOB_KIND_INVALID',
        message: 'kind must be segment-coupon, birthday-coupon, or repurchase-coupon',
      });
    }
    const merchantId = body?.merchantId?.trim();
    const segmentId = body?.segmentId?.trim();
    const couponId = body?.couponId?.trim();
    const couponCode = body?.couponCode?.trim();
    if (!merchantId) {
      throw new BadRequestException({
        code: 'CRM_JOB_MERCHANT_REQUIRED',
        message: 'merchantId is required',
      });
    }
    if (!segmentId) {
      throw new BadRequestException({
        code: 'CRM_JOB_SEGMENT_REQUIRED',
        message: 'segmentId is required',
      });
    }
    if (!couponId && !couponCode) {
      throw new BadRequestException({
        code: 'CRM_JOB_COUPON_REQUIRED',
        message: 'couponId or couponCode is required',
      });
    }

    const resolvedCouponId = await this.resolveCouponId(merchantId, couponId, couponCode);
    if (!resolvedCouponId) {
      throw new BadRequestException({
        code: 'CRM_JOB_COUPON_NOT_FOUND',
        message: 'Coupon not found by couponId or couponCode',
      });
    }

    const job = await this.prisma.crmMarketingJob.create({
      data: {
        merchantId,
        kind,
        segmentId,
        couponId: resolvedCouponId,
        status: 'pending',
      },
    });

    setImmediate(() => this.runJob(job.id).catch(() => {}));
    return { jobId: job.id };
  }

  private async resolveCouponId(
    merchantId: string,
    couponId?: string,
    couponCode?: string,
  ): Promise<string | null> {
    if (couponId) {
      const c = await this.prisma.loyaltyCoupon.findUnique({
        where: { id: couponId, merchantId },
        select: { id: true },
      });
      return c?.id ?? null;
    }
    if (couponCode) {
      const c = await this.prisma.loyaltyCoupon.findUnique({
        where: { merchantId_code: { merchantId, code: couponCode } },
        select: { id: true },
      });
      return c?.id ?? null;
    }
    return null;
  }

  /** GET /crm/jobs/:id — status、result?、error? */
  async getJob(id: string): Promise<{
    id: string;
    status: string;
    result?: { sent: number; skipped: number; errors?: string[] };
    error?: string;
  }> {
    const job = await this.prisma.crmMarketingJob.findUnique({
      where: { id: id?.trim() },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'CRM_JOB_NOT_FOUND',
        message: 'Job not found',
      });
    }
    const out: {
      id: string;
      status: string;
      result?: { sent: number; skipped: number; errors?: string[] };
      error?: string;
    } = {
      id: job.id,
      status: job.status,
    };
    if (job.resultJson) {
      try {
        out.result = JSON.parse(job.resultJson) as JobResultOk;
      } catch {
        out.result = { sent: 0, skipped: 0 };
      }
    }
    if (job.error) out.error = job.error;
    return out;
  }

  /** GET /crm/jobs — 歷史列表（kind/from/to/page/pageSize） */
  async listJobs(params: {
    merchantId?: string;
    kind?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<{ id: string; merchantId: string; kind: string; status: string; createdAt: string; segmentId: string; couponId: string }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const merchantId = params.merchantId?.trim();
    if (!merchantId) {
      throw new BadRequestException({ code: 'CRM_JOB_MERCHANT_REQUIRED', message: 'merchantId is required' });
    }
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

    const fromStr = params.from?.trim();
    const toStr = params.to?.trim();
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    if (fromStr && (!from || Number.isNaN(from.getTime()))) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'invalid from/to' });
    }
    if (toStr && (!to || Number.isNaN(to.getTime()))) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'invalid from/to' });
    }
    if (from && to && from > to) {
      throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'from must be <= to' });
    }

    const where: {
      merchantId: string;
      kind?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { merchantId };
    if (params.kind?.trim()) where.kind = params.kind.trim();
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.crmMarketingJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, merchantId: true, kind: true, status: true, createdAt: true, segmentId: true, couponId: true },
      }),
      this.prisma.crmMarketingJob.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        kind: r.kind,
        status: r.status,
        segmentId: r.segmentId,
        couponId: r.couponId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  private async runJob(jobId: string): Promise<void> {
    await this.prisma.crmMarketingJob.update({
      where: { id: jobId },
      data: { status: 'running' },
    });

    let result: JobResultOk = { sent: 0, skipped: 0 };
    let errorMessage: string | null = null;

    try {
      const job = await this.prisma.crmMarketingJob.findUnique({
        where: { id: jobId },
      });
      if (!job || job.status !== 'running') return;

      const { customerIds } = await this.segmentService.getPreview(job.segmentId);
      const errors: string[] = [];

      for (const customerId of customerIds) {
        try {
          await this.prisma.loyaltyCouponIssue.create({
            data: { customerId, couponId: job.couponId },
          });
          result.sent += 1;
        } catch (e: unknown) {
          const code = (e as { code?: string })?.code;
          if (code === 'P2002') {
            result.skipped += 1;
          } else {
            errors.push(`${customerId}: ${(e as Error).message}`);
          }
        }
      }
      if (errors.length) result.errors = errors.slice(0, 50);

      await this.prisma.crmMarketingJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          resultJson: JSON.stringify(result),
          error: null,
        },
      });
    } catch (e) {
      errorMessage = (e as Error).message;
      await this.prisma.crmMarketingJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: errorMessage },
      });
    }
  }

}
