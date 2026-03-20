import React, { useEffect, useState } from 'react';
import {
  getLoyaltySettings,
  patchLoyaltySettings,
  type LoyaltySettingsDto,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../../shared/components/Button';
import { TextInput } from '../../../shared/components/TextInput';
import { useAdminToast } from '../AdminToastContext';
import { StandardListLayout } from '../../../shared/components/StandardListLayout';

const cardClass = 'rounded-2xl border border-brand-surface bg-white p-5 shadow-sm';

export const LoyaltySettingsPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
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

  return (
    <StandardListLayout
      title="集點設定"
      description="集點規則與效期，寫入需 X-Admin-Key。"
      loading={loading}
      error={err}
      empty={false}
      emptyMessage=""
      emptyDescription=""
      testId="e2e-loyalty-settings"
    >
      {!loading && (
        <div className="space-y-4">
          <div className={cardClass}>
            <h3 className="mb-3 border-b border-brand-surface pb-2 text-sm font-semibold text-content">集點規則</h3>
            <p className="mb-3 text-xs text-muted">
              基本消費：每消費 NT${form.earnPerNT ?? '—'} 得 1 點 · 1 點 = NT${form.pointValueNT ?? '—'} ·
              生日當月點數 ×{form.birthdayMultiplier ?? '—'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="每滿幾元贈 1 點"
                type="number"
                value={String(form.earnPerNT ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, earnPerNT: Number(e.target.value) }))}
              />
              <TextInput
                label="每點價值 NT"
                type="number"
                value={String(form.pointValueNT ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, pointValueNT: Number(e.target.value) }))}
              />
              <TextInput
                label="生日倍率"
                type="number"
                value={String(form.birthdayMultiplier ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, birthdayMultiplier: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className={cardClass}>
            <h3 className="mb-3 border-b border-brand-surface pb-2 text-sm font-semibold text-content">效期與通知</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="滾動效期天數"
                type="number"
                value={String(form.rollingDays ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, rollingDays: Number(e.target.value) }))}
              />
              <TextInput
                label="到期前通知天數"
                type="number"
                value={String(form.notifyDaysBefore ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, notifyDaysBefore: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className={cardClass}>
            <div className="text-sm font-medium text-content">系統整合</div>
            <p className="mt-1 text-xs text-muted">POS 整合：<span className="text-emerald-700">已連線（同網域 API）</span></p>
            <p className="text-xs text-muted">ERP 整合：<span className="text-amber-700">依部署環境</span></p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </div>
      )}
    </StandardListLayout>
  );
};
