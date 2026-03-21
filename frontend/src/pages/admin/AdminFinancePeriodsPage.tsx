import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listFinancePeriods,
  closeFinancePeriod,
  unlockFinancePeriod,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { hasAdminApiKey } from '../../shared/rbac/adminKey';

export const AdminFinancePeriodsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [searchParams] = useSearchParams();
  const defaultMerchantId = useDefaultMerchantId();
  const merchantId = (searchParams.get('merchantId') ?? '').trim() || defaultMerchantId;
  const canWrite = hasAdminApiKey();
  const [items, setItems] = useState<{ id: string; startDate: string; endDate: string; closedAt: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [closeStart, setCloseStart] = useState('');
  const [closeEnd, setCloseEnd] = useState('');
  const [closing, setClosing] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const out = await listFinancePeriods({ merchantId: merchantId || undefined });
    setLoading(false);
    if (!('items' in out)) {
      setErr(getErrorMessage(out as ApiError));
      setItems([]);
      return;
    }
    setItems(out.items);
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    void load();
  }, [load]);

  const handleClose = async () => {
    if (!closeStart.trim() || !closeEnd.trim()) {
      showToast('缺少起迄日', 'err');
      return;
    }
    setClosing(true);
    setErr(null);
    const out = await closeFinancePeriod({
      startDate: closeStart.trim(),
      endDate: closeEnd.trim(),
      merchantId: merchantId || undefined,
    });
    setClosing(false);
    if (!('id' in out)) {
      setErr(getErrorMessage(out as ApiError));
      showToast(getErrorMessage(out as ApiError), 'err');
      return;
    }
    showToast('關帳成功');
    setCloseStart('');
    setCloseEnd('');
    void load();
  };

  const handleUnlock = async (id: string) => {
    if (!confirm('確定解鎖此關帳區間？')) return;
    setUnlockingId(id);
    setErr(null);
    const out = await unlockFinancePeriod(id);
    setUnlockingId(null);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      showToast(getErrorMessage(out as ApiError), 'err');
      return;
    }
    showToast('已解鎖');
    void load();
  };

  const description = useMemo(() => {
    return (
      <span>
        關帳區間列表與解鎖。資料來源 <code className="rounded bg-table-head px-1">GET /finance/periods</code>、
        <code className="rounded bg-table-head px-1">POST /finance/periods/close</code>（需 Admin key）。
      </span>
    );
  }, []);

  return (
    <StandardListLayout
      title="關帳區間（Periods）"
      description={description}
      loading={loading}
      error={err}
      testId="e2e-admin-finance-periods"
    >
      <div className="mb-6 overflow-hidden rounded-xl border border-brand-surface bg-table-head p-4">
        <h3 className="mb-3 text-sm font-semibold text-content">關帳</h3>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            { label: '今日', get: () => { const t = new Date().toISOString().slice(0, 10); return { s: t, e: t }; } },
            { label: '昨日', get: () => { const d = new Date(); d.setDate(d.getDate() - 1); const t = d.toISOString().slice(0, 10); return { s: t, e: t }; } },
            { label: '近 7 日', get: () => { const d = new Date(); const t = d.toISOString().slice(0, 10); d.setDate(d.getDate() - 7); return { s: d.toISOString().slice(0, 10), e: t }; } },
            { label: '近 30 日', get: () => { const d = new Date(); const t = d.toISOString().slice(0, 10); d.setDate(d.getDate() - 30); return { s: d.toISOString().slice(0, 10), e: t }; } },
            { label: '本月', get: () => { const d = new Date(); const t = d.toISOString().slice(0, 10); d.setDate(1); return { s: d.toISOString().slice(0, 10), e: t }; } },
            { label: '上月', get: () => { const d = new Date(); d.setDate(0); const e = d.toISOString().slice(0, 10); d.setDate(1); return { s: d.toISOString().slice(0, 10), e }; } },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              className="rounded-full px-2.5 py-1 text-xs font-medium bg-table-head text-content hover:bg-brand-surface"
              onClick={() => {
                const { s, e } = opt.get();
                setCloseStart(s);
                setCloseEnd(e);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">起日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              value={closeStart}
              onChange={(e) => setCloseStart(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">迄日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              value={closeEnd}
              onChange={(e) => setCloseEnd(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={closing || !merchantId || !canWrite}
            onClick={() => void handleClose()}
          >
            {closing ? '關帳中…' : '關帳'}
          </Button>
          {!merchantId ? <div className="text-xs text-muted">載入商家中…</div> : null}
          {/* 權限提示已隱藏，改由 .env VITE_ADMIN_API_KEY 配置 */}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-surface bg-white">
        <div className="border-b border-brand-surface bg-table-head px-4 py-3 text-sm font-semibold text-content">已關帳區間</div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">載入中…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            尚無關帳區間
            <span className="mt-1 block text-xs">
              若為首次使用，請先執行 <code className="rounded bg-brand-surface px-1 py-0.5">pnpm db:seed</code> 建立示範資料
            </span>
          </div>
        ) : (
          <div className="table-sticky-head overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">起日</th>
                  <th className="px-4 py-2">迄日</th>
                  <th className="px-4 py-2">關帳時間</th>
                  <th className="px-4 py-2">狀態</th>
                  <th className="px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-brand-surface hover:bg-brand-canvas">
                    <td className="px-4 py-2">{row.startDate}</td>
                    <td className="px-4 py-2">{row.endDate}</td>
                    <td className="px-4 py-2 text-muted">{row.closedAt}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={unlockingId === row.id || !merchantId || !canWrite}
                        onClick={() => void handleUnlock(row.id)}
                      >
                        {unlockingId === row.id ? '解鎖中…' : '解鎖'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StandardListLayout>
  );
};
