import React, { useEffect, useMemo, useState } from 'react';
import {
  getPointLedger,
  listLoyaltyCustomers,
  type LedgerItemDto,
  type LoyaltyCustomerRow,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useLoyaltyOutletContext } from './LoyaltyLayout';
import { TextInput } from '../../../shared/components/TextInput';

const TYPES = ['ALL', 'EARNED', 'BURNED', 'LOCKED', 'EXPIRED'] as const;

function typeStyle(t: string) {
  if (t === 'EARNED') return 'bg-emerald-100 text-emerald-800';
  if (t === 'BURNED') return 'bg-rose-100 text-rose-800';
  if (t === 'LOCKED') return 'bg-amber-100 text-amber-900';
  if (t === 'EXPIRED') return 'bg-neutral-200 text-neutral-700';
  return 'bg-slate-100 text-slate-700';
}

export const LoyaltyPointLedgerPage: React.FC = () => {
  const { merchantId } = useLoyaltyOutletContext();
  const [customers, setCustomers] = useState<LoyaltyCustomerRow[]>([]);
  /** 空字串 = 全店流水 */
  const [customerId, setCustomerId] = useState('');
  const [tab, setTab] = useState<(typeof TYPES)[number]>('ALL');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<LedgerItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">點數存摺</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Append-only 流水；預設<strong>全店最近筆數</strong>，可改選單一會員
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium text-neutral-600">會員（選「全店」看最近流水）</label>
          <select
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
                tab === t ? 'bg-slate-900 text-white' : 'bg-white text-neutral-600 ring-1 ring-neutral-200'
              }`}
            >
              {t === 'ALL' ? '全部' : t}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2">交易 ID</th>
              {!customerId && <th className="px-3 py-2">會員</th>}
              <th className="px-3 py-2">類型</th>
              <th className="px-3 py-2 text-right">點數</th>
              <th className="px-3 py-2 text-right">餘額</th>
              <th className="px-3 py-2">說明</th>
              <th className="px-3 py-2">時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={customerId ? 6 : 7}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  尚無流水
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50/80">
                <td className="px-3 py-2 font-mono text-[11px] text-neutral-600">{row.id.slice(0, 12)}…</td>
                {!customerId && (
                  <td className="max-w-[120px] truncate px-3 py-2 font-medium" title={row.customerName ?? ''}>
                    {row.customerName ?? row.customerId?.slice(0, 8) ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${typeStyle(row.type)}`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{row.amount}</td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{row.balanceAfter}</td>
                <td className="max-w-[180px] truncate px-3 py-2 text-neutral-600" title={row.note ?? ''}>
                  {row.note ?? '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
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
