import { Injectable, Logger } from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { parseCsvRows } from '../../product/application/csv-import.util';

const MAX_ROWS = 10_000;

type CustomerLastOrder = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
};

type CustomerPreferredCategory = {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  qty: number;
};

export type CustomerImportPreviewRow = {
  row: number;
  name: string;
  phone: string | null;
  memberLevel: string | null;
  code: string | null;
  /** 需使用者決策（DB 重複或 CSV 內同 phone 重複） */
  conflict: boolean;
  reasons: ('db' | 'csv')[];
  existing?: {
    id: string;
    name: string;
    phone: string | null;
    memberLevel: string | null;
    code: string | null;
  };
};

export type CustomerImportApplyDecision = {
  row: number;
  action: 'skip' | 'create' | 'overwrite';
  /** overwrite 時必填，須為該 merchant 下與該列 phone 對應之客戶 */
  customerId?: string;
};

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function parseCustomerCsv(
  buf: Buffer,
): {
  header: string[];
  nameIdx: number;
  phoneIdx: number;
  memberIdx: number;
  codeIdx: number;
  dataRows: string[][];
} {
  const table = parseCsvRows(buf.toString('utf8'));
  if (table.length === 0) {
    throwBadRequest('CUSTOMER_IMPORT_EMPTY', 'empty csv');
  }
  const header = table[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  if (nameIdx < 0) {
    throwBadRequest('CUSTOMER_IMPORT_HEADER', 'CSV header must include name');
  }
  const phoneIdx = header.indexOf('phone');
  const memberIdx = header.indexOf('memberlevel');
  const codeIdx = header.indexOf('code');
  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throwBadRequest('CUSTOMER_IMPORT_TOO_MANY', `at most ${MAX_ROWS} rows`);
  }
  return { header, nameIdx, phoneIdx, memberIdx, codeIdx, dataRows };
}

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getConsumptionInsights(customerId: string) {
    const now = new Date();
    const since30d = new Date(now);
    since30d.setDate(since30d.getDate() - 30);

    const [lastOrder, firstOrder, totals, ordersLast30d] = await Promise.all([
      this.prisma.posOrder.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, totalAmount: true, discountAmount: true, createdAt: true },
      }),
      this.prisma.posOrder.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.posOrder.aggregate({
        where: { customerId },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.posOrder.count({
        where: { customerId, createdAt: { gte: since30d } },
      }),
    ]);

    const preferredCategories = (await this.prisma.$queryRaw<
      CustomerPreferredCategory[]
    >`
      SELECT
        c.id AS "categoryId",
        c.code AS "categoryCode",
        c.name AS "categoryName",
        COALESCE(SUM(oi.quantity), 0)::int AS "qty"
      FROM "PosOrderItem" oi
      JOIN "PosOrder" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE o."customerId" = ${customerId}
        AND c.id IS NOT NULL
      GROUP BY c.id, c.code, c.name
      ORDER BY COALESCE(SUM(oi.quantity), 0) DESC
      LIMIT 5
    `).map((r) => ({
      ...r,
      qty: Number(r.qty),
    }));

    const ordersCount = totals._count._all;
    const totalSpend = Number(totals._sum.totalAmount ?? 0);

    const lastOrderOut: CustomerLastOrder | null = lastOrder
      ? {
          id: lastOrder.id,
          orderNumber: lastOrder.orderNumber,
          totalAmount: Number(lastOrder.totalAmount),
          discountAmount: Number(lastOrder.discountAmount),
          createdAt: lastOrder.createdAt.toISOString(),
        }
      : null;

    const avgDaysBetweenOrders =
      ordersCount >= 2 && firstOrder && lastOrder
        ? (lastOrder.createdAt.getTime() - firstOrder.createdAt.getTime()) /
          (ordersCount - 1) /
          (24 * 60 * 60 * 1000)
        : null;

    return {
      lastOrder: lastOrderOut,
      totalSpend,
      ordersCount,
      ordersLast30d,
      avgDaysBetweenOrders,
      preferredCategories,
    };
  }

  /** 模糊搜尋 phone／name／memberCode，供 POS 快速選客；q 空白回傳空陣列 */
  async search(merchantId: string, q: string) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_LIST_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const term = (q ?? '').trim();
    if (!term) return { items: [] };
    const rows = await this.prisma.customer.findMany({
      where: {
        merchantId: m,
        OR: [
          { phone: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { memberCode: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        memberLevel: true,
        memberCode: true,
      },
      take: 20,
      orderBy: [{ name: 'asc' }],
    });
    return { items: rows };
  }

  /** 唯讀列表（支援 status、tag、phone、name、memberLevel 篩選）；回傳含 status、blockReason、tags */
  async listByMerchant(
    merchantId: string,
    filters?: {
      status?: string;
      tag?: string;
      phone?: string;
      name?: string;
      memberLevel?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_LIST_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const where: Prisma.CustomerWhereInput = { merchantId: m };
    if (filters?.status?.trim()) {
      where.status = filters.status.trim();
    }
    if (filters?.phone?.trim()) {
      where.phone = { contains: filters.phone.trim(), mode: 'insensitive' };
    }
    if (filters?.name?.trim()) {
      where.name = { contains: filters.name.trim(), mode: 'insensitive' };
    }
    if (filters?.memberLevel?.trim()) {
      where.memberLevel = filters.memberLevel.trim();
    }
    if (filters?.tag?.trim()) {
      where.tags = { array_contains: filters.tag.trim() };
    }
    const page = filters?.page ?? 1;
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          phone: true,
          memberLevel: true,
          memberCode: true,
          joinDate: true,
          status: true,
          blockReason: true,
          tags: true,
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);

    const ids = rows.map((r) => r.id);
    if (!ids.length) return { items: [], total: 0, page, pageSize };
    const balances = await this.prisma.$queryRaw<
      { customerId: string; balanceAfter: number }[]
    >(Prisma.sql`
      SELECT pl."customerId", pl."balanceAfter"
      FROM "PointLedger" pl
      INNER JOIN (
        SELECT "customerId", MAX("createdAt") AS mx
        FROM "PointLedger"
        WHERE "merchantId" = ${m}
          AND "customerId" IN (${Prisma.join(ids)})
        GROUP BY "customerId"
      ) t ON pl."customerId" = t."customerId" AND pl."createdAt" = t.mx
      WHERE pl."merchantId" = ${m}
    `);
    const balMap = new Map(balances.map((b) => [b.customerId, b.balanceAfter]));

    const settings = await this.prisma.loyaltySettings.findUnique({
      where: { merchantId: m },
    });
    const rollingDays = settings?.rollingDays ?? 365;
    const notifyDaysBefore = settings?.notifyDaysBefore ?? 30;

    const lastEarned = await this.prisma.pointLedger.groupBy({
      by: ['customerId'],
      where: {
        merchantId: m,
        customerId: { in: ids },
        type: 'EARNED',
      },
      _max: { createdAt: true },
    });
    const expiringAtMap = new Map<string, string | null>();
    const now = new Date();
    const notifyEnd = new Date(now);
    notifyEnd.setDate(notifyEnd.getDate() + notifyDaysBefore);
    for (const g of lastEarned) {
      const at = g._max.createdAt;
      if (!at) continue;
      const exp = new Date(at);
      exp.setDate(exp.getDate() + rollingDays);
      expiringAtMap.set(g.customerId, exp.toISOString());
    }

    const items = rows.map((r) => {
      const pointBalance = balMap.get(r.id) ?? 0;
      const expiringAt = expiringAtMap.get(r.id) ?? null;
      const expiringSoon =
        expiringAt &&
        pointBalance > 0 &&
        new Date(expiringAt) <= notifyEnd &&
        new Date(expiringAt) >= now
          ? pointBalance
          : 0;
      const tagsArr = Array.isArray(r.tags) ? r.tags : (r.tags as unknown as string[]);
      return {
        id: r.id,
        name: r.name,
        code: r.code,
        phone: r.phone,
        memberLevel: r.memberLevel,
        memberCode: r.memberCode,
        joinDate: r.joinDate?.toISOString() ?? null,
        status: r.status,
        blockReason: r.blockReason ?? null,
        tags: Array.isArray(tagsArr) ? tagsArr : [],
        pointBalance,
        expiringSoon,
        expiringAt,
      };
    });
    return { items, total, page, pageSize };
  }

  /** 單筆詳情（含 pointBalance、expiringSoon、expiringAt）；merchantId 可選用於驗證同商家 */
  async getById(id: string, merchantId?: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id: id?.trim() },
    });
    if (!c) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    if (merchantId?.trim() && c.merchantId !== merchantId.trim()) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    const m = c.merchantId;
    const [balanceRow, settings, lastEarned] = await Promise.all([
      this.prisma.pointLedger.findFirst({
        where: { customerId: c.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loyaltySettings.findUnique({
        where: { merchantId: m },
      }),
      this.prisma.pointLedger.findFirst({
        where: { customerId: c.id, type: 'EARNED' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const pointBalance = balanceRow?.balanceAfter ?? 0;
    const rollingDays = settings?.rollingDays ?? 365;
    const notifyDaysBefore = settings?.notifyDaysBefore ?? 30;
    let expiringAt: string | null = null;
    let expiringSoon = 0;
    if (lastEarned) {
      const exp = new Date(lastEarned.createdAt);
      exp.setDate(exp.getDate() + rollingDays);
      expiringAt = exp.toISOString();
      const now = new Date();
      const notifyEnd = new Date(now);
      notifyEnd.setDate(notifyEnd.getDate() + notifyDaysBefore);
      if (
        pointBalance > 0 &&
        exp >= now &&
        exp <= notifyEnd
      ) {
        expiringSoon = pointBalance;
      }
    }

    const tagsArr = Array.isArray(c.tags) ? c.tags : (c.tags as unknown as string[]);
    const insights = await this.getConsumptionInsights(c.id);
    return {
      id: c.id,
      merchantId: c.merchantId,
      name: c.name,
      code: c.code,
      phone: c.phone,
      email: c.email,
      memberLevel: c.memberLevel,
      memberCode: c.memberCode,
      joinDate: c.joinDate?.toISOString() ?? null,
      status: c.status,
      blockReason: c.blockReason ?? null,
      tags: Array.isArray(tagsArr) ? tagsArr : [],
      pointBalance,
      expiringSoon,
      expiringAt,
      insights,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  /** 建立會員（Admin）；回傳含 id */
  async create(body: {
    merchantId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    memberLevel?: string | null;
    code?: string | null;
    memberCode?: string | null;
  }) {
    const m = (body.merchantId ?? '').trim();
    if (!m) {
      throwBadRequest('CUSTOMER_LIST_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const name = (body.name ?? '').trim();
    if (!name) {
      throwBadRequest('CUSTOMER_NAME_REQUIRED', 'name is required');
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throwNotFound('CUSTOMER_MERCHANT_NOT_FOUND', 'Merchant not found');
    }
    const c = await this.prisma.customer.create({
      data: {
        merchantId: m,
        name,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        memberLevel: body.memberLevel?.trim() || null,
        code: body.code?.trim() || null,
        memberCode: body.memberCode?.trim() || null,
      },
    });
    return {
      id: c.id,
      merchantId: c.merchantId,
      name: c.name,
      code: c.code,
      phone: c.phone,
      email: c.email,
      memberLevel: c.memberLevel,
      memberCode: c.memberCode,
      joinDate: c.joinDate?.toISOString() ?? null,
    };
  }

  /** 更新會員（Admin）；不可改 merchantId；可更新 status、blockReason、tags */
  async update(
    id: string,
    body: Partial<{
      name: string;
      phone: string | null;
      email: string | null;
      memberLevel: string | null;
      code: string | null;
      memberCode: string | null;
      joinDate: string | null;
      status: string;
      blockReason: string | null;
      tags: string[];
    }>,
  ) {
    const c = await this.prisma.customer.findUnique({
      where: { id: id?.trim() },
    });
    if (!c) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    const updated = await this.prisma.customer.update({
      where: { id: c.id },
      data: {
        ...(body.name != null && { name: body.name.trim() }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.email !== undefined && { email: body.email?.trim() || null }),
        ...(body.memberLevel !== undefined && {
          memberLevel: body.memberLevel?.trim() || null,
        }),
        ...(body.code !== undefined && { code: body.code?.trim() || null }),
        ...(body.memberCode !== undefined && {
          memberCode: body.memberCode?.trim() || null,
        }),
        ...(body.status !== undefined && { status: body.status.trim() || 'ACTIVE' }),
        ...(body.blockReason !== undefined && { blockReason: body.blockReason?.trim() || null }),
        ...(body.tags !== undefined && { tags: body.tags as unknown as Prisma.InputJsonValue }),
        ...(body.joinDate !== undefined && {
          joinDate: body.joinDate ? new Date(body.joinDate) : null,
        }),
      },
    });
    return this.getById(updated.id);
  }

  /** 合併會員：主檔保留，併入檔之 PosOrder、PointLedger 歸戶至主檔；併入檔設為 BLOCKED */
  async merge(primaryId: string, mergeIds: string[]) {
    const primary = await this.prisma.customer.findUnique({
      where: { id: primaryId?.trim() },
    });
    if (!primary) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Primary customer not found');
    }
    const ids = mergeIds.filter((id) => id?.trim() && id.trim() !== primaryId.trim());
    if (ids.length === 0) {
      throwBadRequest('CUSTOMER_MERGE_INVALID', 'mergeIds must contain at least one different customer id');
    }
    const others = await this.prisma.customer.findMany({
      where: { id: { in: ids }, merchantId: primary.merchantId },
    });
    if (others.length !== ids.length) {
      throwBadRequest('CUSTOMER_MERGE_INVALID', 'Some merge ids not found or not same merchant');
    }
    const mergeIdSet = new Set(ids);
    await this.prisma.$transaction([
      this.prisma.posOrder.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: primaryId },
      }),
      this.prisma.pointLedger.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: primaryId },
      }),
      this.prisma.customerContactLog.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: primaryId },
      }),
      this.prisma.customer.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'BLOCKED',
          blockReason: `Merged into ${primaryId}`,
        },
      }),
    ]);
    this.logger.log(`merge customers primary=${primaryId} merged=${ids.join(',')}`);
    return { primaryId, merged: ids };
  }

  /** 互動紀錄：GET /customers/:id/contacts */
  async getContacts(customerId: string, merchantId?: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId?.trim() },
    });
    if (!c) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    if (merchantId?.trim() && c.merchantId !== merchantId.trim()) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    const logs = await this.prisma.customerContactLog.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: logs.map((l) => ({
        id: l.id,
        type: l.type,
        note: l.note,
        nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
        createdBy: l.createdBy,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  /** 互動紀錄：POST /customers/:id/contacts */
  async addContact(
    customerId: string,
    body: { type: string; note?: string; nextFollowUpAt?: string; createdBy?: string },
    merchantId?: string,
  ) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId?.trim() },
    });
    if (!c) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    if (merchantId?.trim() && c.merchantId !== merchantId.trim()) {
      throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    const type = (body.type ?? '').trim();
    if (!type) {
      throwBadRequest('CUSTOMER_CONTACT_TYPE_REQUIRED', 'type is required');
    }
    const log = await this.prisma.customerContactLog.create({
      data: {
        customerId: c.id,
        type,
        note: body.note?.trim() || null,
        nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
        createdBy: body.createdBy?.trim() || null,
      },
    });
    return {
      id: log.id,
      type: log.type,
      note: log.note,
      nextFollowUpAt: log.nextFollowUpAt?.toISOString() ?? null,
      createdBy: log.createdBy,
      createdAt: log.createdAt.toISOString(),
    };
  }

  /**
   * CSV：name 必填；phone、memberLevel、code 選填。
   * 同一 merchant 下同 phone 已存在 → 該列 failed（策略：拒絕重複，見 api-design）。
   */
  async importFromCsvBuffer(
    merchantId: string,
    buf: Buffer,
  ): Promise<{ ok: number; failed: { row: number; reason: string }[] }> {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_NOT_FOUND', 'merchant not found');
    }
    const { nameIdx, phoneIdx, memberIdx, codeIdx, dataRows } = parseCustomerCsv(buf);
    let ok = 0;
    const failed: { row: number; reason: string }[] = [];
    for (let r = 0; r < dataRows.length; r++) {
      const cells = dataRows[r];
      const rowNum = r + 2;
      const name = (cells[nameIdx] ?? '').trim();
      if (!name) {
        failed.push({ row: rowNum, reason: 'name required' });
        continue;
      }
      const phone =
        phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() || null : null;
      const memberLevel =
        memberIdx >= 0 ? (cells[memberIdx] ?? '').trim() || null : null;
      const code = codeIdx >= 0 ? (cells[codeIdx] ?? '').trim() || null : null;
      if (phone) {
        const dup = await this.prisma.customer.findFirst({
          where: { merchantId: m, phone },
        });
        if (dup) {
          failed.push({
            row: rowNum,
            reason: `duplicate phone for merchant: ${phone}`,
          });
          continue;
        }
      }
      try {
        await this.prisma.customer.create({
          data: {
            merchantId: m,
            name,
            phone,
            memberLevel,
            code,
          },
        });
        ok++;
      } catch (e) {
        failed.push({
          row: rowNum,
          reason: e instanceof Error ? e.message : 'create failed',
        });
      }
    }
    return { ok, failed };
  }

  /**
   * 預覽：不寫入。回傳 fileHash（sha256）；同一 CSV 內同 phone 多列 → 該 phone 的**每一列**皆 conflict（reasons 含 csv）；
   * DB 已存在同 phone → 該列 conflict（reasons 含 db）。
   */
  async previewImport(
    merchantId: string,
    buf: Buffer,
  ): Promise<{
    fileHash: string;
    rows: CustomerImportPreviewRow[];
    parseErrors: { row: number; reason: string }[];
  }> {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_NOT_FOUND', 'merchant not found');
    }
    const fileHash = sha256(buf);
    const { nameIdx, phoneIdx, memberIdx, codeIdx, dataRows } = parseCustomerCsv(buf);
    const phoneCount = new Map<string, number>();
    for (const cells of dataRows) {
      const phone =
        phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() || '' : '';
      if (phone) {
        phoneCount.set(phone, (phoneCount.get(phone) ?? 0) + 1);
      }
    }
    const uniquePhones = [...phoneCount.keys()];
    const dbByPhone = new Map<
      string,
      { id: string; name: string; phone: string | null; memberLevel: string | null; code: string | null }
    >();
    if (uniquePhones.length) {
      const found = await this.prisma.customer.findMany({
        where: { merchantId: m, phone: { in: uniquePhones } },
        select: {
          id: true,
          name: true,
          phone: true,
          memberLevel: true,
          code: true,
        },
      });
      for (const c of found) {
        if (c.phone) dbByPhone.set(c.phone, c);
      }
    }
    const parseErrors: { row: number; reason: string }[] = [];
    const rows: CustomerImportPreviewRow[] = [];
    for (let r = 0; r < dataRows.length; r++) {
      const cells = dataRows[r];
      const rowNum = r + 2;
      const name = (cells[nameIdx] ?? '').trim();
      const phoneRaw =
        phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() || null : null;
      const memberLevel =
        memberIdx >= 0 ? (cells[memberIdx] ?? '').trim() || null : null;
      const code = codeIdx >= 0 ? (cells[codeIdx] ?? '').trim() || null : null;
      if (!name) {
        parseErrors.push({ row: rowNum, reason: 'name required' });
        continue;
      }
      const reasons: ('db' | 'csv')[] = [];
      if (phoneRaw && (phoneCount.get(phoneRaw) ?? 0) > 1) {
        reasons.push('csv');
      }
      const existing = phoneRaw ? dbByPhone.get(phoneRaw) : undefined;
      if (phoneRaw && existing) {
        reasons.push('db');
      }
      const conflict = reasons.length > 0;
      rows.push({
        row: rowNum,
        name,
        phone: phoneRaw,
        memberLevel,
        code,
        conflict,
        reasons,
        existing: existing
          ? {
              id: existing.id,
              name: existing.name,
              phone: existing.phone,
              memberLevel: existing.memberLevel,
              code: existing.code,
            }
          : undefined,
      });
    }
    return { fileHash, rows, parseErrors };
  }

  /**
   * 套用：須與 preview 同一檔（sha256 一致）。decisions 須涵蓋每一筆「可匯入列」（有 name）；
   * conflict 列：skip | create | overwrite；非 conflict：skip | create。
   * CSV 內同 phone：至多一筆 action create（其餘須 skip 或 overwrite 僅適用 db）。
   */
  async applyImport(
    merchantId: string,
    buf: Buffer,
    fileHash: string,
    decisions: CustomerImportApplyDecision[],
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    failed: { row: number; reason: string }[];
  }> {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const hashExpected = (fileHash ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hashExpected)) {
      throwBadRequest('CUSTOMER_IMPORT_FILE_HASH_REQUIRED', 'fileHash required (sha256 hex)');
    }
    const actual = sha256(buf);
    if (actual !== hashExpected) {
      throwBadRequest('CUSTOMER_IMPORT_FILE_HASH_MISMATCH', 'file content does not match fileHash (re-upload same file as preview)');
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throwBadRequest('CUSTOMER_IMPORT_MERCHANT_NOT_FOUND', 'merchant not found');
    }
    const preview = await this.previewImport(m, buf);
    const decisionByRow = new Map<number, CustomerImportApplyDecision>();
    for (const d of decisions) {
      decisionByRow.set(d.row, d);
    }
    const createdPhone = new Set<string>();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed: { row: number; reason: string }[] = [];

    for (const pr of preview.rows) {
      const d = decisionByRow.get(pr.row);
      if (!d) {
        failed.push({ row: pr.row, reason: 'missing decision for row' });
        continue;
      }
      const action = d.action;
      if (action === 'skip') {
        skipped++;
        continue;
      }
      if (!pr.conflict && action === 'create') {
        if (pr.phone && createdPhone.has(pr.phone)) {
          failed.push({
            row: pr.row,
            reason: 'duplicate phone already created in this apply',
          });
          continue;
        }
        try {
          await this.prisma.customer.create({
            data: {
              merchantId: m,
              name: pr.name,
              phone: pr.phone,
              memberLevel: pr.memberLevel,
              code: pr.code,
            },
          });
          if (pr.phone) createdPhone.add(pr.phone);
          created++;
        } catch (e) {
          failed.push({
            row: pr.row,
            reason: e instanceof Error ? e.message : 'create failed',
          });
        }
        continue;
      }
      if (pr.conflict && action === 'overwrite') {
        if (!d.customerId?.trim()) {
          failed.push({ row: pr.row, reason: 'overwrite requires customerId' });
          continue;
        }
        if (!pr.reasons.includes('db') || !pr.existing || pr.existing.id !== d.customerId.trim()) {
          failed.push({
            row: pr.row,
            reason: 'overwrite only for db conflict with matching customerId',
          });
          continue;
        }
        try {
          await this.prisma.customer.update({
            where: { id: d.customerId.trim() },
            data: {
              name: pr.name,
              memberLevel: pr.memberLevel,
              code: pr.code,
            },
          });
          updated++;
        } catch (e) {
          failed.push({
            row: pr.row,
            reason: e instanceof Error ? e.message : 'update failed',
          });
        }
        continue;
      }
      if (pr.conflict && action === 'create') {
        if (!pr.phone) {
          failed.push({ row: pr.row, reason: 'create on conflict requires phone for dedupe' });
          continue;
        }
        if (createdPhone.has(pr.phone)) {
          failed.push({
            row: pr.row,
            reason: 'only one create per phone for csv-duplicate group',
          });
          continue;
        }
        const inDb = await this.prisma.customer.findFirst({
          where: { merchantId: m, phone: pr.phone },
        });
        if (inDb) {
          failed.push({
            row: pr.row,
            reason: 'phone already exists in DB; use overwrite or skip',
          });
          continue;
        }
        try {
          await this.prisma.customer.create({
            data: {
              merchantId: m,
              name: pr.name,
              phone: pr.phone,
              memberLevel: pr.memberLevel,
              code: pr.code,
            },
          });
          createdPhone.add(pr.phone);
          created++;
        } catch (e) {
          failed.push({
            row: pr.row,
            reason: e instanceof Error ? e.message : 'create failed',
          });
        }
        continue;
      }
      failed.push({ row: pr.row, reason: 'invalid action for row state' });
    }
    return { created, updated, skipped, failed };
  }

  /** CSV 匯出：與 list 同篩選（search=name/phone）；UTF-8；上限 1 萬列；欄位對齊 import（name, phone, memberLevel, code） */
  async exportCustomersCsv(
    merchantId: string,
    filters?: { search?: string; status?: string; tag?: string; memberLevel?: string },
  ): Promise<string> {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('CUSTOMER_LIST_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const where: Prisma.CustomerWhereInput = { merchantId: m };
    if (filters?.status?.trim()) {
      where.status = filters.status.trim();
    }
    if (filters?.memberLevel?.trim()) {
      where.memberLevel = filters.memberLevel.trim();
    }
    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { memberCode: { contains: term, mode: 'insensitive' } },
      ];
    }
    let rows = await this.prisma.customer.findMany({
      where,
      select: { name: true, phone: true, memberLevel: true, code: true, tags: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      take: MAX_ROWS,
    });
    if (filters?.tag?.trim()) {
      const tag = filters.tag.trim();
      rows = rows.filter((r) => {
        const arr = Array.isArray(r.tags) ? r.tags : (r.tags as unknown as string[]);
        return Array.isArray(arr) && arr.includes(tag);
      });
    }
    const csvCell = (v: string | null | undefined): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = 'name,phone,memberLevel,code';
    const lines = rows.map((r) =>
      [csvCell(r.name), csvCell(r.phone), csvCell(r.memberLevel), csvCell(r.code)].join(','),
    );
    return [header, ...lines].join('\n');
  }
}
