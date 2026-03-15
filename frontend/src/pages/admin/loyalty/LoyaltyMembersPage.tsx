import React, { useEffect, useMemo, useState } from 'react';
import { listLoyaltyCustomers, type LoyaltyCustomerRow } from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useLoyaltyOutletContext } from './LoyaltyLayout';
import { TextInput } from '../../../shared/components/TextInput';

export const LoyaltyMembersPage: React.FC = () => {
  const { merchantId } = useLoyaltyOutletContext();
  const [rows, setRows] = useState<LoyaltyCustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!merchantId) return;
    setErr(null);
    const out = await listLoyaltyCustomers(merchantId);
    if ('statusCode' in out) setErr((out as ApiError).message);
    else setRows(out);
  };

  useEffect(() => {
    void load();
  }, [merchantId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(s) ||
        r.phone?.includes(s) ||
        r.id.toLowerCase().includes(s) ||
        (r.memberCode && r.memberCode.toLowerCase().includes(s)),
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">會員管理</h2>
          <p className="mt-1 text-sm text-neutral-500">含點數餘額／即將到期（B3）</p>
        </div>
        <TextInput
          label="搜尋"
          placeholder="姓名、電話、會員碼、ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px]"
        />
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2">會員碼</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">電話</th>
              <th className="px-3 py-2">等級</th>
              <th className="px-3 py-2 text-right">點數</th>
              <th className="px-3 py-2 text-right">即將到期</th>
              <th className="px-3 py-2">到期日</th>
              <th className="px-3 py-2">加入日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50/80">
                <td className="px-3 py-2 font-mono text-xs">{r.memberCode ?? '—'}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 tabular-nums">{r.phone ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.memberLevel ? (
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                      {r.memberLevel}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pointBalance ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.expiringSoon ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {r.expiringAt ? new Date(r.expiringAt).toLocaleDateString('zh-TW') : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {r.joinDate ? new Date(r.joinDate).toLocaleDateString('zh-TW') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        新增會員請至 <a className="text-sky-700 underline" href="/admin/customers/import">客戶 CSV</a> 或後續 POST
        customer。
      </p>
    </div>
  );
};
