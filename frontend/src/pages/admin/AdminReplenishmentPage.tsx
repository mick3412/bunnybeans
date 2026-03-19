import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import {
  getWarehouses,
  getReplenishmentSuggestions,
  createPurchaseOrderFromReplenishment,
  type ReplenishmentSuggestionResult,
  type ApiError,
} from '../../modules/admin/adminApi';
import { listSuppliers } from '../../modules/admin/purchaseApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';

export const AdminReplenishmentPage: React.FC = () => {
  const navigate = useNavigate();
  const merchantId = useDefaultMerchantId();
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [result, setResult] = useState<ReplenishmentSuggestionResult | null>(null);
  const [createPoSubmitting, setCreatePoSubmitting] = useState(false);
  const [createPoNotReady, setCreatePoNotReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysLookback, setDaysLookback] = useState(30);
  const [daysAhead, setDaysAhead] = useState(30);
  const [safetyDays, setSafetyDays] = useState(7);
  const [minSuggestedQty, setMinSuggestedQty] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showPoDraft, setShowPoDraft] = useState(false);

  useEffect(() => {
    void (async () => {
      const ws = await getWarehouses();
      if (Array.isArray(ws)) {
        const sorted = [...ws].sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'zh-Hant'));
        setWarehouses(sorted.map((w) => ({ id: w.id, name: w.name || w.code })));
        if (sorted.length > 0) setWarehouseId(sorted[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      const r = await listSuppliers(merchantId);
      if (r?.data) {
        const sorted = [...r.data].sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'zh-Hant'));
        setSuppliers(sorted.map((s) => ({ id: s.id, name: s.name || s.code })));
        setSupplierId((prev) => (prev || sorted[0]?.id) ?? '');
      }
    })();
  }, [merchantId]);

  const load = async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    const out = await getReplenishmentSuggestions({
      merchantId,
      warehouseId: warehouseId || undefined,
      daysLookback,
      daysAhead,
      safetyDays,
      minSuggestedQty,
      pageSize: 100,
    });
    setLoading(false);
    const maybeErr = out as unknown as ApiError;
    if ('statusCode' in maybeErr && typeof maybeErr.statusCode === 'number') {
      setError(getErrorMessage(maybeErr));
      setResult(null);
      return;
    }
    setResult(out as ReplenishmentSuggestionResult);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, warehouseId]);

  const rows = useMemo(() => result?.items ?? [], [result]);

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected =
    rows.length > 0 && selectedKeys.size > 0 && selectedKeys.size === rows.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
      return;
    }
    const next = new Set<string>();
    for (const r of rows) {
      next.add(`${r.productId}-${r.warehouseId}`);
    }
    setSelectedKeys(next);
  };

  const selectedRows = rows.filter((r) =>
    selectedKeys.has(`${r.productId}-${r.warehouseId}`),
  );

  const handleCreatePoDraft = useCallback(async () => {
    if (selectedRows.length === 0 || !supplierId || !warehouseId) return;
    setCreatePoSubmitting(true);
    setCreatePoNotReady(false);
    setError(null);
    const suggestions = selectedRows.map((r) => ({
      productId: r.productId,
      suggestedQty: r.suggestedQty,
    }));
    const out = await createPurchaseOrderFromReplenishment({
      supplierId,
      warehouseId,
      suggestions,
    });
    setCreatePoSubmitting(false);
    const err = out as ApiError;
    if (err?.statusCode === 404 || err?.statusCode === 501) {
      setCreatePoNotReady(true);
      return;
    }
    if (!('id' in out)) {
      setError(getErrorMessage(err));
      return;
    }
    setShowPoDraft(false);
    navigate(`/admin/purchase-orders`, { replace: true });
  }, [selectedRows, supplierId, warehouseId, navigate]);

  return (
    <StandardListLayout
      title="補貨建議"
      description={`依近 ${result?.config.daysLookback ?? daysLookback} 天銷售與目前庫存計算建議補貨數量。`}
      testId="e2e-admin-replenishment"
      loading={loading}
      error={error}
      empty={false}
      aboveContent={
        createPoNotReady ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            data-testid="e2e-admin-replenishment-po-not-ready"
          >
            建立採購草稿 API 即將上線，請稍後再試。
          </div>
        ) : undefined
      }
      filters={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">倉庫</label>
              <select
                className="min-w-[160px] rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                data-testid="e2e-admin-replenishment-warehouse-select"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 text-xs text-muted">
              <div>
                <label className="mb-1 block text-xs font-medium">觀察天數</label>
                <input
                  type="number"
                  className="w-20 rounded-lg border border-brand-surface px-2 py-1 text-right"
                  value={daysLookback}
                  onChange={(e) => setDaysLookback(Number(e.target.value) || 30)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">預估天數</label>
                <input
                  type="number"
                  className="w-20 rounded-lg border border-brand-surface px-2 py-1 text-right"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(Number(e.target.value) || 30)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">安全天數</label>
                <input
                  type="number"
                  className="w-20 rounded-lg border border-brand-surface px-2 py-1 text-right"
                  value={safetyDays}
                  onChange={(e) => setSafetyDays(Number(e.target.value) || 7)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">最小建議量</label>
                <input
                  type="number"
                  className="w-24 rounded-lg border border-brand-surface px-2 py-1 text-right"
                  value={minSuggestedQty}
                  onChange={(e) => setMinSuggestedQty(Number(e.target.value) || 0)}
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={load}>
                重新計算
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted">
                已選擇 <span className="font-semibold text-content">{selectedRows.length}</span> 筆建議
              </span>
              {selectedRows.length > 0 && (
                <div>
                  <label className="mr-2 text-xs text-muted">供應商</label>
                  <select
                    className="rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    data-testid="e2e-admin-replenishment-supplier-select"
                  >
                    <option value="">— 選擇 —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedRows.length === 0}
                onClick={() => setShowPoDraft(true)}
                data-testid="e2e-admin-replenishment-preview-draft-btn"
              >
                產生採購草稿（預覽）
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedRows.length === 0 || !supplierId || createPoSubmitting}
                onClick={() => void handleCreatePoDraft()}
                data-testid="e2e-admin-replenishment-create-draft-btn"
              >
                {createPoSubmitting ? '建立中…' : '建立採購草稿'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rows.length === 0}
                onClick={() => window.print()}
              >
                列印補貨清單
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <>
      {loading ? null : rows.length === 0 ? (
          <div
            className="py-12 text-center text-sm text-muted"
            data-testid="e2e-admin-replenishment-empty"
          >
            目前沒有需要補貨的商品。
          </div>
        ) : rows.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-brand-surface">
          <div className="table-sticky-head overflow-x-auto bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#cbd5e1] text-brand-primary focus:ring-1 focus:ring-brand-primary"
                      checked={allSelected}
                      aria-label="全選 / 全不選"
                      onChange={toggleAll}
                      data-testid="e2e-admin-replenishment-toggle-all-checkbox"
                    />
                  </th>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">現有庫存</th>
                  <th className="px-3 py-2 text-right">日均銷量</th>
                  <th className="px-3 py-2 text-right">目標庫存</th>
                  <th className="px-3 py-2 text-right text-emerald-700">建議補貨量</th>
                  <th className="px-3 py-2">原因</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.productId}-${r.warehouseId}`}
                    className="border-b border-slate-100 hover:bg-table-head"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#cbd5e1] text-brand-primary focus:ring-1 focus:ring-brand-primary"
                        checked={selectedKeys.has(`${r.productId}-${r.warehouseId}`)}
                        onChange={() => toggleRow(`${r.productId}-${r.warehouseId}`)}
                        data-testid="e2e-admin-replenishment-suggestion-checkbox"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm text-content">{r.productName ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{r.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.onHandQty}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.avgDailySales.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.targetStock.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-emerald-700">
                      {r.suggestedQty}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#64748b]">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}
      {showPoDraft && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
            onClick={() => setShowPoDraft(false)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-brand-surface bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-content">補貨採購草稿（預覽）</h2>
                <p className="mt-0.5 text-xs text-muted">
                  僅整理目前選取的建議作為採購參考，不會直接建立採購單或寫入後端。
                </p>
              </div>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-muted hover:bg-brand-canvas"
                onClick={() => setShowPoDraft(false)}
              >
                關閉
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {selectedRows.length === 0 ? (
                <p className="text-xs text-muted">尚未選擇任何建議，可在列表勾選後再回到此視窗。</p>
              ) : (
                <>
                  <div className="rounded-lg bg-table-head p-3 text-xs text-muted">
                    將下列品項整理成同一倉庫的採購草稿，實際建立採購單時可在「採購單」頁面依供應商與商品再做調整。
                  </div>
                  <div className="rounded-xl border border-brand-surface bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-brand-surface bg-table-head text-[11px] uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">商品</th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2 text-right">現有</th>
                          <th className="px-3 py-2 text-right">建議補貨</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRows.map((r) => (
                          <tr key={`${r.productId}-${r.warehouseId}`} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 text-content">
                              {r.productName ?? '—'}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[11px] text-muted">
                              {r.sku ?? '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-[11px]">
                              {r.onHandQty}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-[11px] text-emerald-700">
                              {r.suggestedQty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
      </>
    </StandardListLayout>
  );
}

