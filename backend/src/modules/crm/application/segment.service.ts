import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { PrismaService } from '../../../shared/database/prisma.service';

export type SegmentRow = {
  id: string;
  name: string;
  merchantId: string;
  conditions: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/** 階段 E 分群：預覽名單、列表；conditions 可後續擴充 */
@Injectable()
export class SegmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /crm/segments — 列表，query merchantId（必填）、page、pageSize
   * Response: { items: SegmentRow[], total }
   */
  async listSegments(merchantId: string, page = 1, pageSize = 20): Promise<{ items: SegmentRow[]; total: number }> {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CRM_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const size = Math.min(Math.max(1, pageSize), 100);
    const skip = (Math.max(1, page) - 1) * size;
    const [items, total] = await Promise.all([
      this.prisma.segment.findMany({
        where: { merchantId: m },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.segment.count({ where: { merchantId: m } }),
    ]);
    const rows: SegmentRow[] = items.map((s) => ({
      id: s.id,
      name: s.name,
      merchantId: s.merchantId,
      conditions: s.conditions as Record<string, unknown> | null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
    return { items: rows, total };
  }

  /**
   * GET /crm/segments/:id/preview
   * 回傳符合分群條件的客戶 id 列表與筆數。
   * 最小實作：僅依 merchantId，conditions 為空或未實作時回傳該商家 ACTIVE 客戶。
   */
  async getPreview(segmentId: string): Promise<{ customerIds: string[]; count: number }> {
    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId?.trim() },
    });
    if (!segment) {
      throwNotFound('SEGMENT_NOT_FOUND', 'Segment not found');
    }

    const conditions = segment.conditions as Record<string, unknown> | null;
    const hasTag = conditions?.tag != null && typeof conditions.tag === 'string';
    const customers = await this.prisma.customer.findMany({
      where: this.buildWhere(segment),
      select: { id: true, tags: true },
    });
    const filtered = hasTag
      ? customers.filter((c) => {
          const tags = c.tags as unknown;
          return Array.isArray(tags) && tags.includes(conditions!.tag);
        })
      : customers;
    const customerIds = filtered.map((c) => c.id);
    return { customerIds, count: customerIds.length };
  }

  /**
   * GET /crm/segments/:id/export — 分群名單匯出 CSV（id,name,phone,memberLevel）
   */
  async getExportCsv(segmentId: string): Promise<string> {
    const { customerIds } = await this.getPreview(segmentId);
    if (customerIds.length === 0) {
      return '\uFEFFid,name,phone,memberLevel\n';
    }
    const rows = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, memberLevel: true },
    });
    const header = 'id,name,phone,memberLevel';
    const escape = (v: string | null | undefined) => {
      const s = String(v ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header, ...rows.map((r) => [r.id, r.name, r.phone ?? '', r.memberLevel ?? ''].map(escape).join(','))];
    return '\uFEFF' + lines.join('\n');
  }

  private buildWhere(segment: { merchantId: string; conditions: unknown }) {
    const where: { merchantId: string; status: string; memberLevel?: string } = {
      merchantId: segment.merchantId,
      status: 'ACTIVE',
    };
    const conditions = segment.conditions as Record<string, unknown> | null;
    if (conditions?.memberLevel != null && typeof conditions.memberLevel === 'string') {
      where.memberLevel = conditions.memberLevel;
    }
    return where;
  }
}

