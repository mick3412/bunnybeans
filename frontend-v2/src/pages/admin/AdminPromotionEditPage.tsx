import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StatusTag } from '../../components/StatusTag';
import { Button } from '../../components/Button';
import { useMerchantId } from '../../hooks/useMerchantId';
import { getPromotionRule, updatePromotionRule, type PromotionRuleDto } from '../../api/promotions';

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDatetimeLocal(s: string): string | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const AdminPromotionEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const merchantId = useMerchantId();
  const [data, setData] = useState<PromotionRuleDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!id) return;
    getPromotionRule(id).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setData(res);
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSave = () => {
    if (!id || !data) return;
    setSaving(true);
    updatePromotionRule(id, merchantId, {
      name: data.name,
      draft: data.draft,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    }).then((res) => {
      setSaving(false);
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setData(res);
    });
  };

  if (err && !data) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-4">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>載入中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>狀態</label>
          <div>
            {data.status === 'active' ? <StatusTag variant="success">進行中</StatusTag> : data.draft ? <StatusTag variant="info">草稿</StatusTag> : <StatusTag variant="warning">{data.status}</StatusTag>}
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="promo-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>名稱</label>
          <input
            id="promo-name"
            type="text"
            className="input-base max-w-md"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </div>
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-content)' }}>
            <input
              type="checkbox"
              checked={data.draft}
              onChange={(e) => setData({ ...data, draft: e.target.checked })}
            />
            草稿
          </label>
        </div>
        <div className="mb-4">
          <label htmlFor="promo-start" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>開始時間</label>
          <input
            id="promo-start"
            type="datetime-local"
            className="input-base max-w-xs"
            value={toDatetimeLocal(data.startsAt)}
            onChange={(e) => setData({ ...data, startsAt: fromDatetimeLocal(e.target.value) })}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="promo-end" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>結束時間</label>
          <input
            id="promo-end"
            type="datetime-local"
            className="input-base max-w-xs"
            value={toDatetimeLocal(data.endsAt)}
            onChange={(e) => setData({ ...data, endsAt: fromDatetimeLocal(e.target.value) })}
          />
        </div>
        {data.summary && (
          <p className="mb-4 text-sm" style={{ color: 'var(--color-muted)' }}>摘要：{data.summary}</p>
        )}
        <Button onClick={handleSave} disabled={saving || !merchantId}>{saving ? '儲存中…' : '儲存'}</Button>
      </div>
    </div>
  );
};
