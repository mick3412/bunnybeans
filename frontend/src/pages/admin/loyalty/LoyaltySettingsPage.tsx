import React, { useEffect, useState } from 'react';
import {
  getLoyaltySettings,
  patchLoyaltySettings,
  type LoyaltySettingsDto,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useLoyaltyOutletContext } from './LoyaltyLayout';
import { Button } from '../../../shared/components/Button';
import { TextInput } from '../../../shared/components/TextInput';
import { useAdminToast } from '../AdminToastContext';

export const LoyaltySettingsPage: React.FC = () => {
  const { merchantId } = useLoyaltyOutletContext();
  const showToast = useAdminToast();
  const [form, setForm] = useState<Partial<LoyaltySettingsDto>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    void (async () => {
      const out = await getLoyaltySettings(merchantId);
      setLoading(false);
      if ('statusCode' in out) {
        setErr((out as ApiError).message);
        return;
      }
      setForm(out);
    })();
  }, [merchantId]);

  const save = async () => {
    if (!merchantId) return;
    setSaving(true);
    setErr(null);
    const out = await patchLoyaltySettings(merchantId, {
      earnPerNT: Number(form.earnPerNT),
      pointValueNT: Number(form.pointValueNT),
      birthdayMultiplier: Number(form.birthdayMultiplier),
      rollingDays: Number(form.rollingDays),
      notifyDaysBefore: Number(form.notifyDaysBefore),
    });
    setSaving(false);
    if ('statusCode' in out) {
      const msg = (out as ApiError).message;
      setErr(msg);
      showToast(msg, 'err');
      return;
    }
    setForm(out);
    showToast('已儲存集點設定', 'ok');
  };

  if (loading) {
    return <div className="text-sm text-neutral-500">載入中…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">系統設定</h2>
        <p className="mt-1 text-sm text-neutral-500">集點規則與效期（PATCH 須 X-Admin-Key）</p>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" data-testid="e2e-loyalty-settings">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">集點規則</div>
        <p className="text-xs text-neutral-600">
          基本消費：每消費 NT${form.earnPerNT ?? '—'} 得 1 點 · 1 點 = NT${form.pointValueNT ?? '—'} ·
          生日當月點數 ×{form.birthdayMultiplier ?? '—'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="每滿幾元贈 1 點（earnPerNT）"
            type="number"
            value={String(form.earnPerNT ?? '')}
            onChange={(e) => setForm((f) => ({ ...f, earnPerNT: Number(e.target.value) }))}
          />
          <TextInput
            label="每點價值 NT（pointValueNT）"
            type="number"
            value={String(form.pointValueNT ?? '')}
            onChange={(e) => setForm((f) => ({ ...f, pointValueNT: Number(e.target.value) }))}
          />
          <TextInput
            label="生日倍率（birthdayMultiplier）"
            type="number"
            value={String(form.birthdayMultiplier ?? '')}
            onChange={(e) => setForm((f) => ({ ...f, birthdayMultiplier: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">效期與通知</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="滾動效期天數（rollingDays）"
            type="number"
            value={String(form.rollingDays ?? '')}
            onChange={(e) => setForm((f) => ({ ...f, rollingDays: Number(e.target.value) }))}
          />
          <TextInput
            label="到期前通知天數（notifyDaysBefore）"
            type="number"
            value={String(form.notifyDaysBefore ?? '')}
            onChange={(e) => setForm((f) => ({ ...f, notifyDaysBefore: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
        <div className="font-medium text-neutral-800">系統整合</div>
        <p className="mt-1">POS 整合：<span className="text-emerald-700">已連線（同網域 API）</span></p>
        <p>ERP 整合：<span className="text-amber-700">依部署環境</span></p>
      </div>
      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? '儲存中…' : '儲存'}
      </Button>
    </div>
  );
};
