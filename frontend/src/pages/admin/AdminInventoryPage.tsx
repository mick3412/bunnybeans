import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import {
  getWarehouses,
  getBalancesEnriched,
  getInventoryEvents,
  getSlowMoving,
  batchStocktake,
  searchProductsByBarcode,
  getExpiringInventory,
  getExpiringInventorySummaryByProduct,
  type ExpiringBatchRow,
  type ExpiringProductSummaryRow,
  fetchCsvExport,
  importInventoryEventsCsv,
  createImportJob,
  getImportJob,
  type WarehouseDto,
  type BalanceEnrichedRow,
  type SlowMovingItem,
  type ApiError,
} from '../../modules/admin/adminApi';
import { Button } from '../../shared/components/Button';
import { StandardFloatBar } from '../../shared/components/StandardFloatBar';
import { getErrorMessage, showAdminApiErrorToast } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { pollImportJob } from '../../shared/utils/pollImportJob';

export const AdminInventoryPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [searchParams] = useSearchParams();
  const merchantIdDefault = useDefaultMerchantId();
  const merchantIdFromUrl = (searchParams.get('merchantId') ?? '').trim();
  const merchantId = merchantIdFromUrl || merchantIdDefault;
  const [invParams, setInvParams] = useScopedSearchParams('inventory.query');
  const invViewParam = invParams.get('invView') ?? searchParams.get('invView');
  const [, setInvHubTabParams] = useScopedSearchParams('inventory.query.hub');
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [view, setView] = useState<'balances' | 'slowMoving'>(
    invViewParam === 'slowMoving' ? 'slowMoving' : 'balances',
  );
  const [balances, setBalances] = useState<BalanceEnrichedRow[]>([]);
  const [events, setEvents] = useState<{
    items: {
      id: string;
      type: string;
      quantity: number;
      occurredAt: string;
      note?: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; failed: { row: number; reason: string }[] } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ ok?: number; failed?: { row: number; reason: string }[] } | null>(
    null,
  );
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [slowParams, setSlowParams] = useState({
    lookbackDays: 30,
    salesThreshold: 0,
    onHandThreshold: 1,
    useWarehouseFilter: true,
  });
  const [slowLoading, setSlowLoading] = useState(false);
  const [slowErr, setSlowErr] = useState<string | null>(null);
  const [slowItems, setSlowItems] = useState<SlowMovingItem[]>([]);
  const [slowRange, setSlowRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [actualQtyByProductId, setActualQtyByProductId] = useState<Record<string, number>>({});
  const [stocktakeSubmitting, setStocktakeSubmitting] = useState(false);
  const [stocktakeMode, setStocktakeMode] = useState<'list' | 'scan'>('list');
  const [scanSku, setScanSku] = useState('');
  const [scanQty, setScanQty] = useState('');
  const [scanChoices, setScanChoices] = useState<Array<{ productId: string; sku: string; name: string; onHandQty?: number | null }>>([]);
  const [expiringOpen, setExpiringOpen] = useState(false);
  const [expiringTab, setExpiringTab] = useState<'product' | 'batch'>('product');
  const [expiringDaysAhead, setExpiringDaysAhead] = useState(30);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringErr, setExpiringErr] = useState<string | null>(null);
  const [expiringProductRows, setExpiringProductRows] = useState<ExpiringProductSummaryRow[]>([]);
  const [expiringBatchRows, setExpiringBatchRows] = useState<ExpiringBatchRow[]>([]);
  const pageSize = 20;
  const hasAdminKey = Boolean((import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim());
  const adminKeyRequiredMsg = getErrorMessage({ statusCode: 401 });

  // 使用 scoped URL param 讓 Hub tab 與此頁 view 同步（同元件切換避免串台）
  useEffect(() => {
    const next = invViewParam === 'slowMoving' ? 'slowMoving' : 'balances';
    setView((prev) => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invViewParam]);

  useEffect(() => {
    const desired = view === 'slowMoving' ? 'slowMoving' : 'balances';
    const invNext = new URLSearchParams();
    invNext.set('invView', desired);
    setInvParams(invNext, { replace: true });

    const hubNext = new URLSearchParams();
    hubNext.set('tab', desired);
    setInvHubTabParams(hubNext, { replace: true });
  }, [view, setInvParams, setInvHubTabParams]);

  const skuToBalanceRow = useMemo(() => {
    const m = new Map<string, BalanceEnrichedRow>();
    for (const r of balances) {
      if (r.sku) m.set(String(r.sku).trim().toLowerCase(), r);
    }
    return m;
  }, [balances]);

  const applyScanAddByProductId = (productId: string) => {
    setSelectedProductIds((prev) => new Set(prev).add(productId));
    const qty = scanQty.trim() === '' ? undefined : Number(scanQty);
    if (qty != null && Number.isFinite(qty) && qty >= 0) {
      setActualQtyByProductId((prev) => ({ ...prev, [productId]: qty }));
    }
    setScanSku('');
    setScanQty('');
  };

  const resolveScanToBalanceRow = async (): Promise<BalanceEnrichedRow | null> => {
    const term = scanSku.trim();
    if (!term) return null;
    const key = term.toLowerCase();
    const row = skuToBalanceRow.get(key);
    if (row) return row;
    const out = await searchProductsByBarcode(term, 10);
    if ('statusCode' in out) {
      showToast(getErrorMessage(out as ApiError), 'err');
      return null;
    }
    const items = out.items ?? [];
    if (!items.length) {
      showToast('找不到此 SKU/條碼', 'err');
      return null;
    }
    if (items.length === 1) {
      const sku = (items[0].sku ?? '').trim().toLowerCase();
      const bySku = sku ? skuToBalanceRow.get(sku) : undefined;
      if (bySku) return bySku;
      showToast('商品已找到，但目前倉庫/列表中沒有對應的 SKU 餘額列', 'err');
      return null;
    }
    setScanChoices(
      items.map((p) => {
        const skuKey = (p.sku ?? '').trim().toLowerCase();
        const bySku = skuKey ? skuToBalanceRow.get(skuKey) : undefined;
        return { productId: p.id, sku: p.sku, name: p.name, onHandQty: bySku?.onHandQty ?? null };
      }),
    );
    showToast(`條碼命中 ${items.length} 筆商品`, 'err');
    return null;
  };

  const loadExpiring = useCallback(async () => {
    if (!warehouseId) return;
    setExpiringLoading(true);
    setExpiringErr(null);
    const daysAhead = expiringDaysAhead;
    const out =
      expiringTab === 'product'
        ? await getExpiringInventorySummaryByProduct({
            warehouseId,
            daysAhead,
            page: 1,
            pageSize: 50,
          })
        : await getExpiringInventory({
            warehouseId,
            daysAhead,
            page: 1,
            pageSize: 50,
          });
    setExpiringLoading(false);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setExpiringErr(getErrorMessage(out as ApiError));
      setExpiringProductRows([]);
      setExpiringBatchRows([]);
      return;
    }
    if (expiringTab === 'product') {
      const d = out as { items: ExpiringProductSummaryRow[] };
      setExpiringProductRows(Array.isArray(d.items) ? d.items : []);
      setExpiringBatchRows([]);
    } else {
      const d = out as { items: ExpiringBatchRow[] };
      setExpiringBatchRows(Array.isArray(d.items) ? d.items : []);
      setExpiringProductRows([]);
    }
  }, [expiringDaysAhead, expiringTab, warehouseId]);

  useEffect(() => {
    if (!expiringOpen) return;
    void loadExpiring();
  }, [expiringOpen, expiringTab, expiringDaysAhead, warehouseId, loadExpiring]);

  useEffect(() => {
    (async () => {
      const w = await getWarehouses();
      if (!Array.isArray(w)) {
        const msg = getErrorMessage(w as ApiError);
        setErr(msg);
        showAdminApiErrorToast(showToast, w as ApiError);
        return;
      }
      setWarehouses(w);
      if (w.length && !warehouseId) setWarehouseId(w[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    setErr(null);
    (async () => {
      const b = await getBalancesEnriched(warehouseId);
      if (!Array.isArray(b)) {
        const msg = getErrorMessage(b as ApiError);
        setErr(msg);
        showAdminApiErrorToast(showToast, b as ApiError);
        setBalances([]);
        return;
      }
      setBalances(b);
      setSelectedProductIds(new Set());
      setActualQtyByProductId({});
    })();
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    (async () => {
      const e = await getInventoryEvents({ warehouseId, page, pageSize });
      if (!e || typeof e !== 'object' || !('items' in e)) {
        const msg = getErrorMessage(e as ApiError);
        setErr(msg);
        showAdminApiErrorToast(showToast, e as ApiError);
        return;
      }
      setEvents({
        items: e.items,
        total: e.total,
        page: e.page,
        pageSize: e.pageSize,
      });
    })();
  }, [warehouseId, page]);

  useEffect(() => {
    if (view !== 'slowMoving') return;
    if (!merchantId) return;
    if (!warehouseId && slowParams.useWarehouseFilter) return;
    let cancelled = false;
    (async () => {
      setSlowLoading(true);
      setSlowErr(null);
      const res = await getSlowMoving({
        merchantId,
        warehouseId: slowParams.useWarehouseFilter ? warehouseId : undefined,
        lookbackDays: Number(slowParams.lookbackDays) || 30,
        salesThreshold: Number(slowParams.salesThreshold) || 0,
        onHandThreshold: Number(slowParams.onHandThreshold) || 1,
      });
      if (cancelled) return;
      if ('statusCode' in res) {
        const msg = getErrorMessage(res as ApiError);
        setSlowErr(msg);
        showAdminApiErrorToast(showToast, res as ApiError);
        setSlowItems([]);
        setSlowRange(null);
      } else {
        setSlowErr(null);
        setSlowItems(Array.isArray(res.items) ? res.items : []);
        setSlowRange({ from: res.from, to: res.to });
      }
      setSlowLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    view,
    merchantId,
    warehouseId,
    slowParams.lookbackDays,
    slowParams.salesThreshold,
    slowParams.onHandThreshold,
    slowParams.useWarehouseFilter,
    showToast,
  ]);

  const totalPages = events ? Math.max(1, Math.ceil(events.total / pageSize)) : 1;

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm" data-testid="e2e-admin-inventory">
      <p className="mb-4 text-sm text-[#64748b]">
        選擇倉庫後檢視即時庫存與事件歷史（append-only）。
      </p>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:gap-4"
        data-testid="e2e-admin-inventory-header"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-muted">倉庫</label>
          <select
            className="h-9 min-w-[140px] shrink-0 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!warehouseId || exporting}
            data-testid="e2e-admin-inventory-export"
            className="shrink-0"
            onClick={async () => {
            if (!warehouseId) return;
            setExporting(true);
            setErr(null);
            const q = `inventory/balances/export?warehouseId=${encodeURIComponent(warehouseId)}`;
            const out = await fetchCsvExport(q, `inventory-balances-${warehouseId.slice(0, 8)}.csv`);
            setExporting(false);
            if (out !== true) {
              const msg = getErrorMessage(out as ApiError);
              setErr(msg);
              showAdminApiErrorToast(showToast, out as ApiError);
            }
          }}
        >
          {exporting ? '匯出中…' : '匯出 CSV'}
        </Button>
        </div>
        <div
          className="flex shrink-0 flex-wrap items-center gap-2"
          data-testid="e2e-admin-inventory-import"
          title={`表頭：sku、warehouseCode、quantity；${adminKeyRequiredMsg}。一般同步、大檔非同步。`}
        >
          <span className="text-[11px] font-medium text-muted">匯入</span>
          <span className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748b]">一般</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importSubmitting || !hasAdminKey}
                className="max-w-[160px] text-xs file:mr-1.5 file:rounded file:border-0 file:bg-brand-surface file:px-2 file:py-0.5 file:text-xs"
                title={!hasAdminKey ? adminKeyRequiredMsg : undefined}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f || !hasAdminKey) return;
                  setImportSubmitting(true);
                  setImportResult(null);
                  const out = await importInventoryEventsCsv(f);
                  setImportSubmitting(false);
                  if ('statusCode' in out) {
                    if (out.statusCode === 401) {
                      const msg = getErrorMessage(out as ApiError);
                      setErr(msg);
                      showToast(msg, 'err');
                    } else {
                      const msg = getErrorMessage(out);
                      setErr(msg);
                      showAdminApiErrorToast(showToast, out);
                    }
                    return;
                  }
                  setErr(null);
                  setImportResult(out);
                  if (warehouseId) {
                    const b = await getBalancesEnriched(warehouseId);
                    if (Array.isArray(b)) setBalances(b);
                    const ev = await getInventoryEvents({ warehouseId, page: 1, pageSize });
                    if (ev && 'items' in ev) {
                      setEvents({
                        items: ev.items,
                        total: ev.total,
                        page: ev.page,
                        pageSize: ev.pageSize,
                      });
                      setPage(1);
                    }
                  }
                }}
              />
              {importSubmitting && <span className="text-[11px] text-[#64748b]">上傳中…</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748b]">大檔</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={jobSubmitting || !hasAdminKey}
                className="max-w-[160px] text-xs file:mr-1.5 file:rounded file:border-0 file:bg-brand-surface file:px-2 file:py-0.5 file:text-xs"
                title={!hasAdminKey ? adminKeyRequiredMsg : undefined}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f || !hasAdminKey) return;
                  setJobSubmitting(true);
                  setJobId(null);
                  setJobStatus(null);
                  setJobError(null);
                  setJobResult(null);
                  const out = await createImportJob('inventory_csv', f);
                  setJobSubmitting(false);
                  if ('statusCode' in out) {
                    const msg = getErrorMessage(out);
                    setErr(msg);
                    showAdminApiErrorToast(showToast, out);
                    return;
                  }
                  setJobId(out.jobId);
                  setJobStatus('pending');
                  void pollImportJob({
                    jobId: out.jobId,
                    getImportJob,
                    onStatus: (j) => {
                      setJobStatus(j.status);
                      if (j.status === 'done') {
                        setJobResult(j.result);
                        if (warehouseId) {
                          void (async () => {
                            const b = await getBalancesEnriched(warehouseId);
                            if (Array.isArray(b)) setBalances(b);
                            const ev = await getInventoryEvents({ warehouseId, page: 1, pageSize });
                            if (ev && 'items' in ev) {
                              setEvents({
                                items: ev.items,
                                total: ev.total,
                                page: ev.page,
                                pageSize: ev.pageSize,
                              });
                              setPage(1);
                            }
                          })();
                        }
                      } else if (j.status === 'failed') {
                        const msg = j.error ?? 'failed';
                        setJobError(msg);
                        showToast(msg, 'err');
                      }
                    },
                    onError: (msg) => {
                      setJobError(msg);
                      showToast(msg, 'err');
                    },
                  });
                }}
              />
              {jobSubmitting && <span className="text-[11px] text-[#64748b]">建立 job…</span>}
            </span>
        </div>
      </div>
      {(importResult || jobId || jobError) && (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-brand-surface bg-table-head px-3 py-2">
          {importResult && (
            <span className="text-[11px] font-medium text-emerald-700">
              成功 {importResult.ok} 列
              {importResult.failed.length > 0 && (
                <details className="ml-1 inline">
                  <summary className="cursor-pointer text-red-700">失敗 {importResult.failed.length} 列</summary>
                  <ul className="mt-1 max-h-20 list-inside list-disc overflow-y-auto rounded border border-red-100 bg-red-50/80 p-1.5 text-red-900">
                    {importResult.failed.slice(0, 20).map((x) => (
                      <li key={`${x.row}-${x.reason}`}>列 {x.row}: {x.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </span>
          )}
          {jobId && (
            <span className="text-[11px] text-[#64748b]">
              大檔 job: <code className="rounded bg-white px-0.5">{jobId.slice(0, 8)}…</code> {jobStatus}
              {jobResult && (
                <span className="ml-1.5">ok {jobResult.ok ?? 0} failed {jobResult.failed?.length ?? 0}</span>
              )}
            </span>
          )}
          {jobError && (
            <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-900" role="alert">
              非同步失敗：{jobError}
            </span>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            view === 'balances'
              ? 'bg-[#1e293b] text-white shadow-sm'
              : 'bg-white text-[#64748b] shadow-sm ring-1 ring-brand-surface hover:bg-table-head'
          }`}
          onClick={() => setView('balances')}
        >
          庫存餘額
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            view === 'slowMoving'
              ? 'bg-[#1e293b] text-white shadow-sm'
              : 'bg-white text-[#64748b] shadow-sm ring-1 ring-brand-surface hover:bg-table-head'
          }`}
          onClick={() => setView('slowMoving')}
        >
          滯銷品
        </button>
        <span className="ml-auto text-xs text-muted">
          {view === 'slowMoving' && slowRange ? `區間：${slowRange.from}～${slowRange.to}` : null}
        </span>
      </div>

      {view === 'balances' ? (
        <>
          <section className="table-sticky-head mb-8 overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
            <div className="border-b border-brand-surface px-4 py-3 text-sm font-semibold text-content">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>庫存餘額</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!warehouseId}
                    onClick={() => {
                      setExpiringOpen(true);
                      void loadExpiring();
                    }}
                  >
                    查看即期庫存
                  </Button>
                  <span className="text-xs font-medium text-muted">盤點模式</span>
                  <button
                    type="button"
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      stocktakeMode === 'list'
                        ? 'bg-[#1e293b] text-white shadow-sm'
                        : 'bg-white text-[#64748b] shadow-sm ring-1 ring-brand-surface hover:bg-table-head',
                    ].join(' ')}
                    onClick={() => setStocktakeMode('list')}
                  >
                    列表盤點
                  </button>
                  <button
                    type="button"
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      stocktakeMode === 'scan'
                        ? 'bg-forge-sidebar text-white shadow-sm'
                        : 'bg-white text-muted shadow-sm ring-1 ring-brand-surface hover:bg-table-head',
                    ].join(' ')}
                    onClick={() => setStocktakeMode('scan')}
                  >
                    掃碼盤點
                  </button>
                </div>
              </div>
            </div>
            {stocktakeMode === 'scan' && (
              <div className="border-b border-brand-surface bg-table-head px-4 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <label className="mb-1 block text-xs font-semibold text-muted">SKU/條碼</label>
                    <input
                      className="h-9 w-full rounded-lg border border-brand-surface bg-white px-3 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="輸入 SKU 或條碼（Enter 送出）"
                      value={scanSku}
                      onChange={(e) => setScanSku(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        void (async () => {
                          const row = await resolveScanToBalanceRow();
                          if (!row) return;
                          applyScanAddByProductId(row.productId);
                        })();
                      }}
                    />
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs font-semibold text-muted">實際數量</label>
                    <input
                      type="number"
                      min={0}
                      className="h-9 w-full rounded-lg border border-brand-surface bg-white px-3 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="—"
                      value={scanQty}
                      onChange={(e) => setScanQty(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void (async () => {
                        const row = await resolveScanToBalanceRow();
                        if (!row) return;
                        applyScanAddByProductId(row.productId);
                        showToast('已加入盤點清單', 'ok');
                      })();
                    }}
                  >
                    加入
                  </Button>
                  <span className="text-xs text-muted" aria-hidden="true" />
                </div>
                {scanChoices.length > 1 ? (
                  <div className="mt-2 rounded-xl border border-brand-surface bg-white p-2">
                    <div className="mb-1 text-xs font-semibold text-muted">條碼命中多筆</div>
                    <div className="flex flex-col gap-1">
                      {scanChoices.slice(0, 6).map((c) => (
                        <button
                          key={c.productId}
                          type="button"
                          className="flex items-center justify-between gap-2 rounded-lg border border-brand-surface px-2 py-1.5 text-left text-xs hover:bg-brand-canvas"
                          onClick={() => {
                            const skuKey = (c.sku ?? '').trim().toLowerCase();
                            const row = skuKey ? skuToBalanceRow.get(skuKey) : undefined;
                            if (!row) {
                              showToast('目前倉庫/列表中沒有對應的 SKU 餘額列', 'err');
                              return;
                            }
                            applyScanAddByProductId(row.productId);
                            setScanChoices([]);
                            showToast('已加入盤點清單', 'ok');
                          }}
                        >
                          <span className="min-w-0 truncate text-content">
                            {c.name}{' '}
                            <span className="ml-2 font-mono text-[11px] text-muted">{c.sku}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-muted">
                            在庫 {typeof c.onHandQty === 'number' ? c.onHandQty : '—'}
                          </span>
                        </button>
                      ))}
                      {scanChoices.length > 6 ? (
                        <div className="text-[11px] text-muted">…尚有 {scanChoices.length - 6} 筆，請縮小條碼/limit 或清理資料</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-brand-surface bg-table-head text-[#64748b]">
                  <tr>
                    <th className="px-4 py-2 w-10">
                      <input
                        type="checkbox"
                        aria-label="全選"
                        checked={balances.length > 0 && balances.every((b) => selectedProductIds.has(b.productId))}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedProductIds(() => {
                            if (!checked) return new Set();
                            return new Set(balances.map((b) => b.productId));
                          });
                        }}
                      />
                    </th>
                    <th className="px-4 py-2">SKU</th>
                    <th className="px-4 py-2">品名</th>
                    <th className="px-4 py-2 text-right">現量</th>
                    <th className="px-4 py-2 text-right">實際數量</th>
                    <th className="px-4 py-2">更新時間</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        此倉尚無庫存匯總（可自「入庫／盤點」或 POS 銷售後產生）
                      </td>
                    </tr>
                  ) : (
                    balances.map((row) => (
                      <tr key={`${row.productId}-${row.warehouseId}`} className="border-t border-brand-surface">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(row.productId)}
                            aria-label={`選取 ${row.sku ?? row.productId.slice(0, 8)}`}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedProductIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(row.productId);
                                else next.delete(row.productId);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{row.sku ?? row.productId.slice(0, 8)}</td>
                        <td className="px-4 py-2">{row.name ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{row.onHandQty}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            className="h-8 w-28 rounded-lg border border-brand-surface bg-white px-2 py-1 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                            value={
                              Number.isFinite(actualQtyByProductId[row.productId] as number)
                                ? String(actualQtyByProductId[row.productId])
                                : ''
                            }
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value;
                              setActualQtyByProductId((prev) => ({
                                ...prev,
                                [row.productId]: v === '' ? (undefined as unknown as number) : Number(v),
                              }));
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 text-xs text-[#64748b]">
                          {new Date(row.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {expiringOpen ? (
            <div className="mt-4 w-full rounded-2xl border border-brand-surface bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-content">即期庫存監控</div>
                  <div className="mt-0.5 text-xs text-muted">
                    warehouseId：<span className="font-mono">{warehouseId || '—'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-brand-surface px-2 py-1 text-xs text-muted hover:bg-table-head"
                  onClick={() => setExpiringOpen(false)}
                >
                  關閉
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="flex items-center gap-2 rounded-full bg-table-head px-2 py-1">
                  <button
                    type="button"
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      expiringTab === 'product'
                        ? 'bg-forge-sidebar text-white shadow-sm'
                        : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
                    ].join(' ')}
                    onClick={() => setExpiringTab('product')}
                  >
                    依商品彙總
                  </button>
                  <button
                    type="button"
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      expiringTab === 'batch'
                        ? 'bg-forge-sidebar text-white shadow-sm'
                        : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
                    ].join(' ')}
                    onClick={() => setExpiringTab('batch')}
                  >
                    依批次明細
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">daysAhead</label>
                  <input
                    type="number"
                    min={1}
                    className="h-9 w-28 rounded-lg border border-brand-surface bg-white px-3 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    value={expiringDaysAhead}
                    onChange={(e) => setExpiringDaysAhead(Math.max(1, Number(e.target.value || 1)))}
                  />
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadExpiring()} disabled={expiringLoading}>
                  {expiringLoading ? '載入中…' : '重新整理'}
                </Button>
                {expiringErr ? <div className="text-xs text-brand-danger">{expiringErr}</div> : null}
              </div>

              <div className="rounded-xl border border-brand-surface">
                {/* 控制列固定（上方），表格區可捲動 */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {expiringLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-muted">載入中…</div>
                  ) : expiringTab === 'product' ? (
                    expiringProductRows.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-muted">沒有即期商品</div>
                    ) : (
                      <div className="table-sticky-head overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                            <tr>
                              <th className="px-4 py-2">SKU</th>
                              <th className="px-4 py-2">商品</th>
                              <th className="px-4 py-2">最早到期</th>
                              <th className="px-4 py-2">即期總量</th>
                              <th className="px-4 py-2">倉庫數</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expiringProductRows.map((r) => (
                              <tr key={r.productId} className="border-t border-brand-surface hover:bg-brand-canvas">
                                <td className="px-4 py-2 font-mono text-xs text-content">{r.sku ?? '—'}</td>
                                <td className="px-4 py-2 text-content">{r.productName ?? r.productId.slice(0, 8) + '…'}</td>
                                <td className="px-4 py-2 tabular-nums text-muted">{r.earliestExpiryDate}</td>
                                <td className="px-4 py-2 tabular-nums text-content">{r.expiringQty}</td>
                                <td className="px-4 py-2 tabular-nums text-muted">{r.warehousesCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : expiringBatchRows.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">沒有即期批次</div>
                  ) : (
                    <div className="table-sticky-head overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                          <tr>
                            <th className="px-4 py-2">SKU</th>
                            <th className="px-4 py-2">商品</th>
                            <th className="px-4 py-2">批次</th>
                            <th className="px-4 py-2">到期日</th>
                            <th className="px-4 py-2">數量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expiringBatchRows.map((b, idx) => (
                            <tr
                              key={`${b.productId}-${b.warehouseId}-${b.batchCode ?? 'none'}-${b.expiryDate}-${idx}`}
                              className="border-t border-brand-surface hover:bg-brand-canvas"
                            >
                              <td className="px-4 py-2 font-mono text-xs text-content">{b.sku ?? '—'}</td>
                              <td className="px-4 py-2 text-content">{b.productName ?? b.productId.slice(0, 8) + '…'}</td>
                              <td className="px-4 py-2 font-mono text-xs text-muted">{b.batchCode ?? '—'}</td>
                              <td className="px-4 py-2 tabular-nums text-muted">{b.expiryDate}</td>
                              <td className="px-4 py-2 tabular-nums text-content">{b.onHandQty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <StandardFloatBar visible={selectedProductIds.size > 0} className="w-[min(860px,calc(100%-24px))]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-content">
                  已選 {selectedProductIds.size} 筆
                </span>
                <span className="text-xs text-muted">輸入「實際數量」後可一鍵提交盤點</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedProductIds(new Set());
                      setActualQtyByProductId({});
                    }}
                  >
                    清除
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={stocktakeSubmitting || !warehouseId}
                    onClick={async () => {
                      if (!warehouseId) return;
                      const lines = Array.from(selectedProductIds)
                        .map((pid) => ({ productId: pid, actualQty: Number(actualQtyByProductId[pid]) }))
                        .filter((x) => Number.isFinite(x.actualQty));
                      if (!lines.length) {
                        showToast('缺少實際數量', 'err');
                        return;
                      }
                      setStocktakeSubmitting(true);
                      const out = await batchStocktake({ warehouseId, lines });
                      setStocktakeSubmitting(false);
                      if ('statusCode' in out) {
                        if (out.statusCode === 404 || out.statusCode === 501) {
                          showToast('批次盤點 API 即將上線', 'err');
                        } else if (out.statusCode === 401) {
                          showToast('權限不足', 'err');
                        } else {
                          showToast(getErrorMessage(out), 'err');
                        }
                        return;
                      }
                      showToast(`已提交盤點：成功 ${out.ok} 筆`, out.failed?.length ? 'err' : 'ok');
                      setSelectedProductIds(new Set());
                      setActualQtyByProductId({});
                      const b = await getBalancesEnriched(warehouseId);
                      if (Array.isArray(b)) setBalances(b);
                      const ev = await getInventoryEvents({ warehouseId, page: 1, pageSize });
                      if (ev && 'items' in ev) {
                        setEvents({
                          items: ev.items,
                          total: ev.total,
                          page: ev.page,
                          pageSize: ev.pageSize,
                        });
                        setPage(1);
                      }
                    }}
                  >
                    {stocktakeSubmitting ? '提交中…' : '一鍵提交盤點'}
                  </Button>
                </div>
              </div>
          </StandardFloatBar>

          <section className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
            <div className="border-b border-brand-surface px-4 py-3 text-sm font-semibold text-content">
              異動明細
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-brand-surface bg-table-head text-[#64748b]">
                  <tr>
                    <th className="px-4 py-2">時間</th>
                    <th className="px-4 py-2">類型</th>
                    <th className="px-4 py-2 text-right">數量</th>
                    <th className="px-4 py-2">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {!events || events.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted">
                        無事件
                      </td>
                    </tr>
                  ) : (
                    events.items.map((ev) => (
                      <tr key={ev.id} className="border-t border-brand-surface">
                        <td className="px-4 py-2 text-xs whitespace-nowrap">
                          {new Date(ev.occurredAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{ev.type}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{ev.quantity}</td>
                        <td className="max-w-xs truncate px-4 py-2 text-xs text-[#64748b]">
                          {ev.note ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {events && events.total > pageSize && (
              <div className="flex items-center justify-between border-t border-brand-surface px-4 py-3 text-sm">
                <span className="text-[#64748b]">
                  共 {events.total} 筆 · 第 {page} / {totalPages} 頁
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    className="rounded border border-brand-surface px-3 py-1 disabled:opacity-40"
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一頁
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    className="rounded border border-brand-surface px-3 py-1 disabled:opacity-40"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一頁
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-brand-surface bg-white shadow-sm">
          <div className="border-b border-brand-surface px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-content">滯銷品</div>
                <div className="mt-0.5 text-xs text-muted">
                  近 N 天銷量小於門檻且庫存大於門檻的品項（可調參數）
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!merchantId || slowLoading}
                onClick={async () => {
                  if (!merchantId) return;
                  setSlowLoading(true);
                  setSlowErr(null);
                  const res = await getSlowMoving({
                    merchantId,
                    warehouseId: slowParams.useWarehouseFilter ? warehouseId : undefined,
                    lookbackDays: Number(slowParams.lookbackDays) || 30,
                    salesThreshold: Number(slowParams.salesThreshold) || 0,
                    onHandThreshold: Number(slowParams.onHandThreshold) || 1,
                  });
                  if ('statusCode' in res) {
                    const msg = getErrorMessage(res as ApiError);
                    setSlowErr(msg);
                    showAdminApiErrorToast(showToast, res as ApiError);
                    setSlowItems([]);
                    setSlowRange(null);
                  } else {
                    setSlowErr(null);
                    setSlowItems(Array.isArray(res.items) ? res.items : []);
                    setSlowRange({ from: res.from, to: res.to });
                  }
                  setSlowLoading(false);
                }}
              >
                重新載入
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm text-muted">
                <span className="mb-1 block text-xs text-muted">回溯天數</span>
                <input
                  type="number"
                  min={1}
                  className="h-9 w-28 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={slowParams.lookbackDays}
                  onChange={(e) => setSlowParams((p) => ({ ...p, lookbackDays: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm text-muted">
                <span className="mb-1 block text-xs text-muted">銷量門檻（&lt;）</span>
                <input
                  type="number"
                  min={0}
                  className="h-9 w-32 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={slowParams.salesThreshold}
                  onChange={(e) => setSlowParams((p) => ({ ...p, salesThreshold: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm text-muted">
                <span className="mb-1 block text-xs text-muted">庫存門檻（&gt;）</span>
                <input
                  type="number"
                  min={0}
                  className="h-9 w-32 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={slowParams.onHandThreshold}
                  onChange={(e) => setSlowParams((p) => ({ ...p, onHandThreshold: Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={slowParams.useWarehouseFilter}
                  onChange={(e) => setSlowParams((p) => ({ ...p, useWarehouseFilter: e.target.checked }))}
                />
                只看目前倉庫
              </label>
              {slowLoading && <span className="text-xs text-muted">載入中…</span>}
            </div>
            {slowErr && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {slowErr}
              </div>
            )}
            {!merchantId && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                需先取得 merchantId 才能查詢滯銷品
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-[#64748b]">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">品名</th>
                  <th className="px-4 py-2 text-right">區間銷量</th>
                  <th className="px-4 py-2 text-right">現量</th>
                  <th className="px-4 py-2">倉庫</th>
                </tr>
              </thead>
              <tbody>
                {slowItems.length === 0 && !slowLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      目前條件下沒有滯銷品
                    </td>
                  </tr>
                ) : (
                  slowItems.map((row) => (
                    <tr key={`${row.productId}-${row.warehouseId ?? 'all'}`} className="border-t border-brand-surface">
                      <td className="px-4 py-2 font-mono text-xs">{row.sku ?? row.productId.slice(0, 8)}</td>
                      <td className="px-4 py-2">{row.name ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.soldQty}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{row.onHandQty}</td>
                      <td className="px-4 py-2 text-xs text-muted">{row.warehouseId ? row.warehouseId.slice(0, 8) : '全部'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
