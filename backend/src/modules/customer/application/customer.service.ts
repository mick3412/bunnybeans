import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../shared/database/prisma.service';
import { parseCsvRows } from '../../product/application/csv-import.util';

const MAX_ROWS = 10_000;

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
    throw new BadRequestException({
      message: 'empty csv',
      code: 'CUSTOMER_IMPORT_EMPTY',
    });
  }
  const header = table[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  if (nameIdx < 0) {
    throw new BadRequestException({
      message: 'CSV header must include name',
      code: 'CUSTOMER_IMPORT_HEADER',
    });
  }
  const phoneIdx = header.indexOf('phone');
  const memberIdx = header.indexOf('memberlevel');
  const codeIdx = header.indexOf('code');
  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new BadRequestException({
      message: `at most ${MAX_ROWS} rows`,
      code: 'CUSTOMER_IMPORT_TOO_MANY',
    });
  }
  return { header, nameIdx, phoneIdx, memberIdx, codeIdx, dataRows };
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /** 唯讀列表（POS 選客戶／顯示 memberLevel）；不寫入 DB */
  async listByMerchant(merchantId: string) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'CUSTOMER_LIST_MERCHANT_REQUIRED',
      });
    }
    return this.prisma.customer.findMany({
      where: { merchantId: m },
      select: {
        id: true,
        name: true,
        code: true,
        phone: true,
        memberLevel: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });
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
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'CUSTOMER_IMPORT_MERCHANT_REQUIRED',
      });
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throw new BadRequestException({
        message: 'merchant not found',
        code: 'CUSTOMER_IMPORT_MERCHANT_NOT_FOUND',
      });
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
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'CUSTOMER_IMPORT_MERCHANT_REQUIRED',
      });
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throw new BadRequestException({
        message: 'merchant not found',
        code: 'CUSTOMER_IMPORT_MERCHANT_NOT_FOUND',
      });
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
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'CUSTOMER_IMPORT_MERCHANT_REQUIRED',
      });
    }
    const hashExpected = (fileHash ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hashExpected)) {
      throw new BadRequestException({
        message: 'fileHash required (sha256 hex)',
        code: 'CUSTOMER_IMPORT_FILE_HASH_REQUIRED',
      });
    }
    const actual = sha256(buf);
    if (actual !== hashExpected) {
      throw new BadRequestException({
        message: 'file content does not match fileHash (re-upload same file as preview)',
        code: 'CUSTOMER_IMPORT_FILE_HASH_MISMATCH',
      });
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { id: m } });
    if (!merchant) {
      throw new BadRequestException({
        message: 'merchant not found',
        code: 'CUSTOMER_IMPORT_MERCHANT_NOT_FOUND',
      });
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
}
