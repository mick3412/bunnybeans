import React, { useEffect, useState } from 'react';
import {
  createLoyaltyCoupon,
  listLoyaltyCoupons,
  patchLoyaltyCoupon,
  type LoyaltyCouponDto,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useLoyaltyOutletContext } from './LoyaltyLayout';
import { Button } from '../../../shared/components/Button';
import { TextInput } from '../../../shared/components/TextInput';
import { useAdminToast } from '../AdminToastContext';

export const LoyaltyCouponsPage: React.FC = () => {
  const { merchantId } = useLoyaltyOutletContext();
  const showToast = useAdminToast();
  const [items, setItems] = useState<LoyaltyCouponDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [value, setValue] = useState('10');
  const [discountType, setDiscountType] = useState('FIXED');

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

  const add = async () => {
    if (!merchantId || !code.trim() || !name.trim()) {
      showToast('請填券碼與名稱', 'err');
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
      <h2 className="text-lg font-semibold text-neutral-900">優惠券</h2>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold text-neutral-500">新增（需 Admin Key）</div>
        <div className="flex flex-wrap gap-3">
          <TextInput label="券碼" value={code} onChange={(e) => setCode(e.target.value)} className="w-36" />
          <TextInput label="名稱" value={name} onChange={(e) => setName(e.target.value)} className="min-w-[160px]" />
          <div>
            <label className="mb-1 block text-xs text-neutral-600">類型</label>
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
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-neutral-50 text-xs text-neutral-600">
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
            {items.map((c) => (
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
