import { BadRequestException, Injectable } from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class PurchaseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /purchase/reports/supplier-rankings
   * 依已完成驗收單（COMPLETED）彙總各供應商採購金額（Σ qualifiedQty × unitCost）與驗收筆數。
   */
  async supplierRankings(q: { merchantId: string; from?: string; to?: string }) {
    const merchantId = q.merchantId?.trim();
    if (!merchantId) {
      throwBadRequest('PURCHASE_REPORT_MERCHANT_REQUIRED', 'merchantId required');
    }

    let from: Date | undefined;
    let to: Date | undefined;
    if (q.from?.trim()) {
      from = new Date(q.from.trim());
      if (Number.isNaN(from.getTime())) {
        throwBadRequest('REPORT_INVALID_RANGE', 'invalid from');
      }
    }
    if (q.to?.trim()) {
      to = new Date(q.to.trim());
      if (Number.isNaN(to.getTime())) {
        throwBadRequest('REPORT_INVALID_RANGE', 'invalid to');
      }
    }
    if (from && to && from > to) {
      throwBadRequest('REPORT_INVALID_RANGE', 'from must be <= to');
    }

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    const notes = await this.prisma.receivingNote.findMany({
      where: {
        merchantId,
        status: 'COMPLETED',
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      include: {
        purchaseOrder: {
          select: {
            supplierId: true,
            supplier: { select: { id: true, code: true, name: true } },
          },
        },
        lines: {
          include: { purchaseOrderLine: { select: { unitCost: true } } },
        },
      },
    });

    const map = new Map<
      string,
      {
        supplierId: string;
        supplierCode: string;
        supplierName: string;
        receivingNotesCount: number;
        totalAmount: number;
      }
    >();

    for (const rn of notes) {
      const s = rn.purchaseOrder.supplier;
      let noteAmount = 0;
      for (const line of rn.lines) {
        const qty = line.qualifiedQty;
        const cost = Number(line.purchaseOrderLine.unitCost);
        noteAmount += qty * cost;
      }
      noteAmount = Math.round(noteAmount * 100) / 100;
      const cur = map.get(s.id) ?? {
        supplierId: s.id,
        supplierCode: s.code,
        supplierName: s.name,
        receivingNotesCount: 0,
        totalAmount: 0,
      };
      cur.receivingNotesCount += 1;
      cur.totalAmount = Math.round((cur.totalAmount + noteAmount) * 100) / 100;
      map.set(s.id, cur);
    }

    const items = Array.from(map.values()).sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
      return a.supplierCode.localeCompare(b.supplierCode);
    });

    return {
      items,
      from: from?.toISOString().slice(0, 10),
      to: to?.toISOString().slice(0, 10),
    };
  }
}
