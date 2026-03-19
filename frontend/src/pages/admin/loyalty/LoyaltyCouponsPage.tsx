import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createLoyaltyCoupon,
  listLoyaltyCoupons,
  patchLoyaltyCoupon,
  type LoyaltyCouponDto,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../../shared/components/Button';
import { TextInput } from '../../../shared/components/TextInput';
import { useAdminToast } from '../AdminToastContext';

/** 前端狀態篩選（後端未支援時）；對齊 crm-loyalty-ui-plan 搜尋券號／狀態 */
type CouponStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'FULL';

export const LoyaltyCouponsPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const [globalSearchParams] = useSearchParams();
  const [scopedParams, setScopedSearchParams] = useScopedSearchParams('member.coupons');
  const qFromUrl = scopedParams.get('q') ?? globalSearchParams.get('q') ?? '';
  const showToast = useAdminToast();
  const [items, setItems] = useState<LoyaltyCouponDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [value, setValue] = useState('10');
  const [discountType, setDiscountType] = useState('FIXED');
  const [searchCode, setSearchCode] = useState(qFromUrl);
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>('ALL');

  const load = async () => {
    if (!merchantId) return;
    const out = await listLoyaltyCoupons(merchantId);
    if ('statusCode' in out) setErr((out as ApiError).message);
    else {
      setErr(null);
      setItems(out.items ?? []);
    }
  };

  useEffect(() => {
    void load();
  }, [merchantId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (searchCode.trim()) next.set('q', searchCode.trim());
    setScopedSearchParams(next, { replace: true });
  }, [searchCode, setScopedSearchParams]);

  const filteredItems = useMemo(() => {
    let list = items;
    const codeQ = searchCode.trim().toLowerCase();
    if (codeQ) {
      list = list.filter((c) => c.code.toLowerCase().includes(codeQ) || (c.name && c.name.toLowerCase().includes(codeQ)));
    }
    if (statusFilter === 'ACTIVE') list = list.filter((c) => c.active);
    if (statusFilter === 'INACTIVE') list = list.filter((c) => !c.active);
    if (statusFilter === 'FULL') list = list.filter((c) => c.maxUses != null && c.usedCount >= c.maxUses);
    return list;
  }, [items, searchCode, statusFilter]);

  const add = async () => {
    if (!merchantId || !code.trim() || !name.trim()) {
      showToast('缺少券碼或名稱', 'err');
      return;
    }
    const out = await createLoyaltyCoupon(merchantId, {
      code: code.trim(),
      name: name.trim(),
      discountType,
      value: Number(value) || 0,
      active: true,
    });
    if ('statusCode' in out) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    showToast('已新增優惠券', 'ok');
    setCode('');
    setName('');
    void load();
  };

  const toggle = async (c: LoyaltyCouponDto) => {
    const out = await patchLoyaltyCoupon(merchantId, c.id, { active: !c.active });
    if ('statusCode' in out) showToast((out as ApiError).message, 'err');
    else void load();
  };

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold text-muted">搜尋／篩選</span>
        <TextInput
          label="券號／名稱"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          placeholder="搜尋券號或名稱"
          className="w-44 !py-1.5"
        />
        <div>
          <label className="mb-1 block text-xs text-muted">狀態</label>
          <select
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CouponStatusFilter)}
          >
            <option value="ALL">全部</option>
            <option value="ACTIVE">啟用中</option>
            <option value="INACTIVE">已停用</option>
            <option value="FULL">已用罄</option>
          </select>
        </div>
      </div>
      <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold text-muted">新增（需 Admin Key）</div>
        <div className="flex flex-wrap gap-3">
          <TextInput label="券碼" value={code} onChange={(e) => setCode(e.target.value)} className="w-36" />
          <TextInput label="名稱" value={name} onChange={(e) => setName(e.target.value)} className="min-w-[160px]" />
          <div>
            <label className="mb-1 block text-xs text-muted">類型</label>
            <select
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="FIXED">FIXED</option>
              <option value="PERCENT">PERCENT</option>
            </select>
          </div>
          <TextInput label="值" value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />
          <div className="flex items-end">
            <Button type="button" onClick={() => void add()}>
              新增
            </Button>
          </div>
        </div>
      </div>
      <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brand-surface bg-table-head text-xs text-muted">
            <tr>
              <th className="px-3 py-2">券碼</th>
              <th className="px-3 py-2">名稱</th>
              <th className="px-3 py-2">類型</th>
              <th className="px-3 py-2 text-right">值</th>
              <th className="px-3 py-2 text-right">已用</th>
              <th className="px-3 py-2">啟用</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.discountType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.value}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.usedCount}/{c.maxUses ?? '∞'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-sky-700 hover:underline"
                    onClick={() => void toggle(c)}
                  >
                    {c.active ? '停用' : '啟用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
