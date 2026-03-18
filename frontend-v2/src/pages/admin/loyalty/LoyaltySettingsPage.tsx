import React, { useEffect, useState } from 'react';
import { FormField } from '../../../components/FormField';
import { Button } from '../../../components/Button';
import { useMerchantId } from '../../../hooks/useMerchantId';
import { getLoyaltySettings, patchLoyaltySettings, type LoyaltySettingsDto } from '../../../api/loyalty';
import type { ApiError } from '../../../api/client';

export const LoyaltySettingsPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [data, setData] = useState<LoyaltySettingsDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getLoyaltySettings(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setData(res);
    });
  }, [merchantId]);

  const handleSave = () => {
    if (!data) return;
    patchLoyaltySettings(merchantId, {
      earnPerNT: data.earnPerNT,
      pointValueNT: data.pointValueNT,
      rollingDays: data.rollingDays,
      notifyDaysBefore: data.notifyDaysBefore,
    }).then((res: LoyaltySettingsDto | ApiError) => {
      if ('statusCode' in res) setErr(res.message);
      else setData(res);
    });
  };

  const updateNum = (key: 'earnPerNT' | 'pointValueNT' | 'rollingDays' | 'notifyDaysBefore', v: string | number) => {
    if (!data) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setData({ ...data, [key]: n });
  };

  if (err && !data) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="card p-4">
        <h3 className="section-title mb-4">集點規則</h3>
        <FormField
          id="earnPerNT"
          label="每消費多少元得 1 點"
          type="number"
          value={data?.earnPerNT ?? ''}
          onChange={(v) => updateNum('earnPerNT', v)}
          min={1}
        />
        <FormField
          id="pointValueNT"
          label="1 點折抵多少元"
          type="number"
          value={data?.pointValueNT ?? ''}
          onChange={(v) => updateNum('pointValueNT', v)}
          min={0}
        />
        <FormField
          id="rollingDays"
          label="點數有效天數"
          type="number"
          value={data?.rollingDays ?? ''}
          onChange={(v) => updateNum('rollingDays', v)}
          min={1}
        />
        <FormField
          id="notifyDaysBefore"
          label="到期前幾天通知"
          type="number"
          value={data?.notifyDaysBefore ?? ''}
          onChange={(v) => updateNum('notifyDaysBefore', v)}
          min={0}
        />
        <div className="mt-4">
          <Button onClick={handleSave}>儲存設定</Button>
        </div>
      </div>
    </div>
  );
};
