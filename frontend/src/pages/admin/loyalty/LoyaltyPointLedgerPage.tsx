import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getPointLedger,
  listLoyaltyCustomers,
  type LedgerItemDto,
  type LoyaltyCustomerRow,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { Alert } from '../../../shared/components/Alert';
import { EmptyState } from '../../../shared/components/EmptyState';
import { TextInput } from '../../../shared/components/TextInput';
import { ReferenceIdLink } from '../../../shared/components/ReferenceIdLink';

const TYPES = ['ALL', 'EARNED', 'BURNED', 'LOCKED', 'EXPIRED'] as const;

const TYPE_LABELS: Record<string, string> = {
  ALL: '全部',
  EARNED: '贈點',
  BURNED: '扣點',
  LOCKED: '鎖定',
  EXPIRED: '已過期',
};

function typeStyle(t: string) {
  if (t === 'EARNED') return 'bg-emerald-100 text-emerald-800';
  if (t === 'BURNED') return 'bg-rose-100 text-rose-800';
  if (t === 'LOCKED') return 'bg-amber-100 text-amber-900';
  if (t === 'EXPIRED') return 'bg-brand-surface text-muted';
  return 'bg-brand-canvas text-muted';
}

export const LoyaltyPointLedgerPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const [searchParams] = useSearchParams();
  const customerIdFromUrl = searchParams.get('customerId') ?? '';
  const [customers, setCustomers] = useState<LoyaltyCustomerRow[]>([]);
  /** 空字串 = 全店流水；可從 URL ?customerId= 預填 */
  const [customerId, setCustomerId] = useState(customerIdFromUrl);
  const [tab, setTab] = useState<(typeof TYPES)[number]>('ALL');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<LedgerItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (customerIdFromUrl) setCustomerId(customerIdFromUrl);
  }, [customerIdFromUrl]);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      const out = await listLoyaltyCustomers(merchantId);
      if (!('statusCode' in out)) setCustomers(out);
    })();
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;
    setErr(null);
    void (async () => {
      const out = await getPointLedger(
        merchantId,
        customerId.trim() || undefined,
        200,
      );
      if ('statusCode' in out) setErr((out as ApiError).message);
      else setItems(out.items ?? []);
    })();
  }, [merchantId, customerId]);

  const filtered = useMemo(() => {
    let rows = items;
    if (tab !== 'ALL') rows = rows.filter((i) => i.type === tab);
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (i) =>
        (i.customerName && i.customerName.toLowerCase().includes(s)) ||
        (i.note && i.note.toLowerCase().includes(s)) ||
        (i.referenceId && i.referenceId.toLowerCase().includes(s)) ||
        i.id.toLowerCase().includes(s),
    );
  }, [items, tab, q]);

  return (
    <div className="space-y-4">
      <div className="border-b border-brand-surface pb-2">
        <p className="text-sm text-muted">
          Append-only 流水；預設<strong>全店最近筆數</strong>，可改選單一會員
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium text-muted">會員（選「全店」看最近流水）</label>
          <select
            className="w-full rounded-lg border border-brand-surface px-3 py-2 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">全店最近流水</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.memberCode ? `(${c.memberCode})` : ''}
              </option>
            ))}
          </select>
        </div>
        <TextInput
          label="搜尋"
          placeholder="會員、說明、訂單 ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px]"
        />
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === t ? 'bg-forge-sidebar text-white' : 'bg-white text-muted ring-1 ring-brand-surface'
              }`}
            >
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <Alert variant="error">{err}</Alert>
      )}
      <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brand-surface bg-table-head text-xs text-muted">
            <tr>
              <th className="px-3 py-2">交易 ID</th>
              {!customerId && <th className="px-3 py-2">會員</th>}
              <th className="px-3 py-2">類型</th>
              <th className="px-3 py-2 text-right">點數</th>
              <th className="px-3 py-2 text-right">餘額</th>
              <th className="px-3 py-2">說明</th>
              <th className="px-3 py-2">訂單</th>
              <th className="px-3 py-2">時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-surface">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={customerId ? 7 : 8} className="p-0">
                  <EmptyState message="尚無流水" />
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-table-head">
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{row.id.slice(0, 12)}…</td>
                {!customerId && (
                  <td className="max-w-[120px] truncate px-3 py-2 font-medium" title={row.customerName ?? ''}>
                    {row.customerName ?? row.customerId?.slice(0, 8) ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${typeStyle(row.type)}`}>
                    {TYPE_LABELS[row.type] ?? row.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{row.amount}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{row.balanceAfter}</td>
                <td className="max-w-[180px] truncate px-3 py-2 text-muted" title={row.note ?? ''}>
                  {row.note ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {row.type && ['EARNED', 'BURNED'].includes(row.type) ? (
                    <ReferenceIdLink
                      referenceId={row.referenceId ?? null}
                      auditSource="loyalty-point-ledger"
                      auditField="referenceId"
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                  {new Date(row.createdAt).toLocaleString('zh-TW')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
