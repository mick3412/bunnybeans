import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePersistentTableColumnWidths } from '../../shared/hooks/usePersistentTableColumnWidths';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductTags,
  batchUpdateProductPrice,
  importProductsCsv,
  createImportJob,
  getImportJob,
  getCategories,
  getBrands,
  getInventoryBalances,
  getWarehouses,
  getExpiringInventory,
  type ProductFullDto,
  type ApiError,
  type ExpiringBatchRow,
  type ExpiringInventoryResult,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../shared/components/Button';
import { StandardFloatBar } from '../../shared/components/StandardFloatBar';
import { TextInput } from '../../shared/components/TextInput';
import { useAdminToast } from './AdminToastContext';
import { pollImportJob } from '../../shared/utils/pollImportJob';
import { ADMIN_KEY_REQUIRED_HINT, hasAdminApiKey } from '../../shared/rbac/adminKey';

const PRODUCTS_TABLE_COL_STORAGE = 'admin-products-table-col-widths-v3';
const PRODUCTS_TABLE_COL_DEFAULTS = {
  sku: 120,
  name: 180,
  category: 100,
  brand: 100,
  listPrice: 80,
  salePrice: 80,
  costPrice: 80,
  stock: 104,
  expiry: 120,
  spec: 120,
  actions: 120,
} as const;

/** 依倉庫名稱字數估算欄寬（px） */
function warehouseColWidthPx(name: string): number {
  const n = [...name].length || 1;
  return Math.min(220, Math.max(100, 12 * n + 28));
}

export const AdminProductsPage: React.FC = () => {
  const location = useLocation();
  const merchantId = useDefaultMerchantId();
  const { showToast } = useAdminToast();
  const canWrite = hasAdminApiKey();
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductFullDto[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  /** productId -> warehouseId -> onHandQty */
  const [stockByProductWarehouse, setStockByProductWarehouse] = useState<
    Record<string, Record<string, number>>
  >({});
  const [warehousesOrdered, setWarehousesOrdered] = useState<{ id: string; name: string }[]>([]);
  /** false = 僅總庫存；true = 總庫存 + 各倉欄 */
  const [showWhDetail, setShowWhDetail] = useState(false);
  /** false = 收合；true = 展開顯示尺寸/容量/重量/款式 */
  const [showSpecDetail, setShowSpecDetail] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductFullDto | null>(null);
  /** 常駐右欄：true = 新增表單；false 且 editing 有值 = 編輯該列 */
  const [creating, setCreating] = useState(true);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: number;
    failed: { row: number; reason: string }[];
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ ok?: number; failed?: { row: number; reason: string }[] } | null>(
    null,
  );
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSalePrice, setBulkSalePrice] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  /** 右側商品表單抽屜：預設收起，點右緣或編輯時展開 */
  const [panelOpen, setPanelOpen] = useState(false);

  /** 即將到期批次列表（依當前編輯商品查詢） */
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchRow[] | null>(null);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringError, setExpiringError] = useState<string | null>(null);

  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    specSize: '',
    specCapacity: '',
    specStyle: '',
    expiryDescription: '',
    specWeight: '',
    listPrice: '0',
    salePrice: '0',
    costPrice: '',
    categoryId: '',
    brandId: '',
    tags: [] as string[],
  });
  const [searchQ, setSearchQ] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('');
  const [sortBy, setSortBy] = useState<
    'sku' | 'name' | 'category' | 'brand' | 'listPrice' | 'salePrice' | 'costPrice' | 'stock' | 'expiry'
  >('sku');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setErr(null);
    const [p, c, b, bal, wh] = await Promise.all([
      getProducts(),
      getCategories(),
      getBrands(),
      getInventoryBalances(),
      getWarehouses(),
    ]);
    if (!Array.isArray(p)) {
      setErr(getErrorMessage(p as ApiError));
      return;
    }
    setProducts(p);
    if (Array.isArray(c)) setCategories(c);
    if (Array.isArray(b)) setBrands(b);
    if (Array.isArray(wh)) {
      const sorted = [...wh].sort((a, b) =>
        (a.name || a.code).localeCompare(b.name || b.code, 'zh-Hant'),
      );
      setWarehousesOrdered(sorted.map((w) => ({ id: w.id, name: w.name || w.code })));
    } else {
      setWarehousesOrdered([]);
    }
    if (Array.isArray(bal)) {
      const sum: Record<string, number> = {};
      const matrix: Record<string, Record<string, number>> = {};
      for (const row of bal) {
        sum[row.productId] = (sum[row.productId] ?? 0) + row.onHandQty;
        if (!matrix[row.productId]) matrix[row.productId] = {};
        matrix[row.productId][row.warehouseId] =
          (matrix[row.productId][row.warehouseId] ?? 0) + row.onHandQty;
      }
      setStockByProduct(sum);
      setStockByProductWarehouse(matrix);
    } else {
      setStockByProduct({});
      setStockByProductWarehouse({});
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      const out = await getProductTags(merchantId);
      setTagOptions(Array.isArray(out) ? out : []);
    })();
  }, [merchantId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQ(q);
    }
  }, [location.search]);

  useEffect(() => {
    if (!editing?.id) {
      setExpiringBatches(null);
      setExpiringError(null);
      setExpiringLoading(false);
      return;
    }
    void (async () => {
      setExpiringLoading(true);
      setExpiringError(null);
      const out = await getExpiringInventory({
        productId: editing.id,
        daysAhead: 30,
        pageSize: 50,
      });
      setExpiringLoading(false);
      const maybeError = out as unknown as ApiError;
      if ('statusCode' in maybeError && typeof maybeError.statusCode === 'number') {
        setExpiringError(maybeError.message);
        setExpiringBatches(null);
        return;
      }
      const data = out as unknown as ExpiringInventoryResult;
      setExpiringBatches(Array.isArray(data.items) ? data.items : []);
    })();
  }, [editing?.id]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter((p) => {
        const sku = p.sku?.toLowerCase() ?? '';
        const name = p.name?.toLowerCase() ?? '';
        return sku.includes(q) || name.includes(q);
      });
    }
    if (filterCategoryId) {
      list = list.filter((p) => p.categoryId === filterCategoryId);
    }
    if (filterBrandId) {
      list = list.filter((p) => p.brandId === filterBrandId);
    }
    return list;
  }, [products, searchQ, filterCategoryId, filterBrandId]);

  const categoryName = (id: string | null | undefined) =>
    id ? categories.find((c) => c.id === id)?.name ?? '—' : '—';
  const brandName = (id: string | null | undefined) =>
    id ? brands.find((b) => b.id === id)?.name ?? '—' : '—';

  const sortedProducts = useMemo(() => {
    const rows = [...filteredProducts];
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
    rows.sort((a, b) => {
      const av =
        sortBy === 'sku'
          ? a.sku
          : sortBy === 'name'
            ? a.name
            : sortBy === 'category'
              ? categoryName(a.categoryId)
              : sortBy === 'brand'
                ? brandName(a.brandId)
                : sortBy === 'listPrice'
                  ? num(a.listPrice)
                  : sortBy === 'salePrice'
                    ? num(a.salePrice)
                    : sortBy === 'costPrice'
                      ? num(a.costPrice)
                      : sortBy === 'stock'
                        ? stockByProduct[a.id] ?? 0
                        : a.expiryDescription ?? '';
      const bv =
        sortBy === 'sku'
          ? b.sku
          : sortBy === 'name'
            ? b.name
            : sortBy === 'category'
              ? categoryName(b.categoryId)
              : sortBy === 'brand'
                ? brandName(b.brandId)
                : sortBy === 'listPrice'
                  ? num(b.listPrice)
                  : sortBy === 'salePrice'
                    ? num(b.salePrice)
                    : sortBy === 'costPrice'
                      ? num(b.costPrice)
                      : sortBy === 'stock'
                        ? stockByProduct[b.id] ?? 0
                        : b.expiryDescription ?? '';
      const delta =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'zh-Hant');
      return sortDir === 'asc' ? delta : -delta;
    });
    return rows;
  }, [brandName, categoryName, filteredProducts, sortBy, sortDir, stockByProduct]);

  const allFilteredIds = useMemo(() => filteredProducts.map((p) => p.id), [filteredProducts]);
  const selectedCount = selectedIds.size;
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    // 避免搜尋切換後選到看不到的列
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const allow = new Set(allFilteredIds);
      for (const id of prev) {
        if (allow.has(id)) next.add(id);
      }
      return next;
    });
  }, [allFilteredIds]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({
      sku: '',
      name: '',
      description: '',
      specSize: '',
      specCapacity: '',
      specStyle: '',
      expiryDescription: '',
      specWeight: '',
      listPrice: '0',
      salePrice: '0',
      costPrice: '',
      categoryId: '',
      brandId: '',
      tags: [],
    });
  };

  const openEdit = (row: ProductFullDto) => {
    setEditing(row);
    setCreating(false);
    setPanelOpen(true);
    setForm({
      sku: row.sku,
      name: row.name,
      description: row.description ?? '',
      specSize: row.specSize ?? '',
      specCapacity: row.specCapacity ?? '',
      specStyle: row.specStyle ?? row.specColor ?? '',
      expiryDescription: row.expiryDescription ?? '',
      specWeight: row.specWeight ?? (row.weightGrams != null ? `${row.weightGrams}g` : ''),
      listPrice: row.listPrice ?? '0',
      salePrice: row.salePrice ?? '0',
      costPrice: row.costPrice ?? '',
      categoryId: row.categoryId ?? '',
      brandId: row.brandId ?? '',
      tags: row.tags ?? [],
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const tags = form.tags.map((t) => t.trim()).filter(Boolean);
    const body = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      specSize: form.specSize.trim() || null,
      specCapacity: form.specCapacity.trim() || null,
      specStyle: form.specStyle.trim() || null,
      specWeight: form.specWeight.trim() || null,
      expiryDescription: form.expiryDescription.trim() || null,
      listPrice: form.listPrice.trim() || '0',
      salePrice: form.salePrice.trim() || '0',
      costPrice: form.costPrice.trim() || null,
      categoryId: form.categoryId || null,
      brandId: form.brandId || null,
      tags,
    };
    if (creating || !editing) {
      const out = await createProduct(body);
      if ('statusCode' in out) {
        const msg = getErrorMessage(out as ApiError);
        setErr(msg);
        showToast(msg, 'err');
        return;
      }
      showToast('已新增商品');
    } else {
      const out = await updateProduct(editing.id, body);
      if ('statusCode' in out) {
        const msg = getErrorMessage(out as ApiError);
        setErr(msg);
        showToast(msg, 'err');
        return;
      }
      showToast('已更新商品');
    }
    await load();
    openCreate();
    setPanelOpen(false);
  };

  const { widths: colW, onResizeStart } = usePersistentTableColumnWidths(
    PRODUCTS_TABLE_COL_STORAGE,
    { ...PRODUCTS_TABLE_COL_DEFAULTS },
    56,
    (m) =>
      m.stock < 88 ? { ...m, stock: Math.max(96, PRODUCTS_TABLE_COL_DEFAULTS.stock) } : m,
  );
  const whColWidths = useMemo(
    () => warehousesOrdered.map((w) => warehouseColWidthPx(w.name)),
    [warehousesOrdered],
  );
  const whColsSum = showWhDetail ? whColWidths.reduce((a, b) => a + b, 0) : 0;
  const tableMinWidth =
    colW.sku +
    colW.name +
    colW.category +
    colW.brand +
    colW.listPrice +
    colW.salePrice +
    colW.costPrice +
    colW.stock +
    whColsSum +
    colW.expiry +
    colW.spec +
    colW.actions;

  const onDelete = async (id: string) => {
    if (!confirm('確定刪除此商品？（若有庫存事件請確認）')) return;
    const out = await deleteProduct(id);
    if ('statusCode' in out) {
      const msg = getErrorMessage(out as ApiError);
      setErr(msg);
      showToast(msg, 'err');
      return;
    }
    showToast('已刪除商品');
    if (editing?.id === id) openCreate();
    await load();
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm text-[#64748b]">
          與 POS 共用主檔 API；庫存唯讀。
        </p>
        <details className="rounded-lg border border-brand-surface bg-table-head px-3 py-1.5" data-testid="e2e-admin-products-import">
          <summary className="cursor-pointer text-xs font-medium text-muted hover:text-content">CSV 匯入</summary>
          <div className="mt-2 flex flex-wrap items-center gap-3 pb-1">
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748b]">一般</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="max-w-[160px] text-xs file:mr-1.5 file:rounded file:border-0 file:bg-brand-canvas file:px-2 file:py-0.5 file:text-xs"
                disabled={importSubmitting}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setImportSubmitting(true);
                  setImportResult(null);
                  const out = await importProductsCsv(f);
                  setImportSubmitting(false);
                  if ('statusCode' in out) {
                    const msg = getErrorMessage(out);
                    setErr(msg);
                    showToast(msg, 'err');
                    return;
                  }
                  setErr(null);
                  setImportResult(out);
                  showToast(`匯入完成：成功 ${out.ok} 筆${out.failed.length ? `，失敗 ${out.failed.length} 列` : ''}`);
                  await load();
                }}
              />
              {importSubmitting && <span className="text-[11px] text-[#64748b]">上傳中…</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748b]">大檔</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="max-w-[160px] text-xs file:mr-1.5 file:rounded file:border-0 file:bg-brand-canvas file:px-2 file:py-0.5 file:text-xs"
                disabled={jobSubmitting}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setJobSubmitting(true);
                  setJobId(null);
                  setJobStatus(null);
                  setJobError(null);
                  setJobResult(null);
                  const out = await createImportJob('products_csv', f);
                  setJobSubmitting(false);
                  if ('statusCode' in out) {
                    showToast(getErrorMessage(out), 'err');
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
                        showToast(
                          `Job 完成：ok ${(j.result as { ok?: number })?.ok ?? 0}`,
                          (j.result as { failed?: unknown[] })?.failed?.length ? 'err' : 'ok',
                        );
                        void load();
                      } else if (j.status === 'failed') {
                        const msg = j.error ?? 'job failed';
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
          {(importResult || jobId) && (
            <div className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px]">
              {importResult && (
                <span className="font-medium text-emerald-700">成功 {importResult.ok} 筆</span>
              )}
              {importResult?.failed && importResult.failed.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-red-700">失敗 {importResult.failed.length} 列</summary>
                  <ul className="mt-1 max-h-20 list-inside list-disc overflow-y-auto rounded border border-red-100 bg-red-50/80 p-1.5 text-red-900">
                    {importResult.failed.slice(0, 20).map((x) => (
                      <li key={`${x.row}-${x.reason}`}>第 {x.row} 列：{x.reason}</li>
                    ))}
                    {importResult.failed.length > 20 && <li>…其餘 {importResult.failed.length - 20} 列</li>}
                  </ul>
                </details>
              )}
              {jobId && (
                <span className="ml-2 text-[#64748b]">
                  大檔 job: <code className="rounded bg-white px-0.5">{jobId.slice(0, 8)}…</code> {jobStatus}
                  {jobResult && <span className="ml-1">ok {jobResult.ok ?? 0} failed {jobResult.failed?.length ?? 0}</span>}
                </span>
              )}
            </div>
          )}
          {jobError && (
            <div className="mt-1.5 rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-900" role="alert">
              非同步失敗：{jobError}
            </div>
          )}
        </details>
      </div>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {/* 行動版：展開時遮罩 */}
      {panelOpen && (
        <button
          type="button"
          aria-label="關閉表單"
          className="fixed inset-0 z-[90] bg-black/25 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* 右緣懸浮：收起時可點開（向左展開表單） */}
      {!panelOpen && (
        <button
          type="button"
          className="fixed right-0 top-1/2 z-[95] flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-brand-primary bg-brand-primary px-2.5 py-6 text-xs font-semibold text-white shadow-lg transition hover:bg-brand-primary-hover"
          onClick={() => {
            openCreate();
            setPanelOpen(true);
          }}
        >
          <span className="[writing-mode:vertical-rl] tracking-widest">新增商品</span>
        </button>
      )}

      <div className="min-w-0 w-full">
        {/* 表格全寬 */}
        <div className="min-w-0 overflow-hidden">
          <div className="mb-3 flex flex-wrap items-end justify-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">分類</label>
              <select
                className="h-9 min-w-[120px] rounded-lg border border-brand-surface bg-white px-2 text-sm"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
              >
                <option value="">全部</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">品牌</label>
              <select
                className="h-9 min-w-[100px] rounded-lg border border-brand-surface bg-white px-2 text-sm"
                value={filterBrandId}
                onChange={(e) => setFilterBrandId(e.target.value)}
              >
                <option value="">全部</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <TextInput
              label="搜尋"
              placeholder="SKU 或名稱"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-56 !py-1.5"
            />
          </div>
          <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
            <table
              className="table-fixed text-left text-sm"
              style={{ width: tableMinWidth, minWidth: '100%' }}
            >
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: colW.sku }} />
                <col style={{ width: colW.name }} />
                <col style={{ width: colW.category }} />
                <col style={{ width: colW.brand }} />
                <col style={{ width: colW.listPrice }} />
                <col style={{ width: colW.salePrice }} />
                <col style={{ width: colW.costPrice }} />
                <col style={{ width: colW.stock }} />
                {showWhDetail &&
                  warehousesOrdered.map((w, i) => (
                    <col key={w.id} style={{ width: whColWidths[i] }} />
                  ))}
                <col style={{ width: colW.expiry }} />
                <col style={{ width: colW.spec }} />
                <col style={{ width: colW.actions }} />
              </colgroup>
              <thead className="border-b border-brand-surface bg-table-head text-muted">
                <tr>
                  <th className="sticky left-0 z-[1] bg-table-head px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      aria-label="全選"
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedIds(() => {
                          if (!checked) return new Set();
                          return new Set(allFilteredIds);
                        });
                      }}
                    />
                  </th>
                  {(
                    [
                      ['sku', 'SKU'],
                      ['name', '名稱'],
                      ['category', '類別'],
                      ['brand', '品牌'],
                      ['listPrice', '定價'],
                      ['salePrice', '售價'],
                      ['costPrice', '成本'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className={[
                        'relative px-3 py-2 select-none',
                        key === 'sku' ? 'sticky z-[1] bg-table-head' : '',
                        key === 'name' ? 'sticky z-[1] bg-table-head' : '',
                        key === 'listPrice' || key === 'salePrice' || key === 'costPrice' ? 'text-right' : '',
                      ].join(' ')}
                      style={{
                        width: colW[key],
                        left: key === 'sku' ? 44 : key === 'name' ? 44 + colW.sku : undefined,
                      }}
                    >
                      <button
                        type="button"
                        className="flex max-w-full items-center gap-1 truncate pr-2 text-left"
                        onClick={() => {
                          const next = key as
                            | 'sku'
                            | 'name'
                            | 'category'
                            | 'brand'
                            | 'listPrice'
                            | 'salePrice'
                            | 'costPrice';
                          if (sortBy === next) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                          else {
                            setSortBy(next);
                            setSortDir('asc');
                          }
                        }}
                      >
                        <span className="truncate">{label}</span>
                        <span className="text-[10px] text-muted">
                          {sortBy === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`調整「${label}」欄寬（拖曳後會記住）`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-brand-primary/15 active:bg-brand-primary/25"
                        onMouseDown={(e) => onResizeStart(key, e)}
                      />
                    </th>
                  ))}
                  <th
                    className="relative px-3 py-2 select-none text-right"
                    style={{ width: colW.stock }}
                  >
                    <div className="flex flex-col items-end gap-1 pr-2">
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() => {
                          if (sortBy === 'stock') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                          else {
                            setSortBy('stock');
                            setSortDir('asc');
                          }
                        }}
                      >
                        <span>總庫存</span>
                        <span className="text-[10px] text-muted">
                          {sortBy === 'stock' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-normal text-brand-primary hover:underline"
                        onClick={() => setShowWhDetail((v) => !v)}
                      >
                        {showWhDetail ? '收合各倉' : '展開各倉'}
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="調整「總庫存」欄寬（拖曳後會記住）"
                      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-brand-primary/15 active:bg-brand-primary/25"
                      onMouseDown={(e) => onResizeStart('stock', e)}
                    />
                  </th>
                  {showWhDetail &&
                    warehousesOrdered.map((w, i) => (
                      <th
                        key={w.id}
                        className="relative px-2 py-2 select-none text-center align-bottom"
                        style={{ width: whColWidths[i] }}
                        title={w.name}
                      >
                        <span className="line-clamp-2 max-w-full whitespace-normal break-words text-xs font-medium leading-tight">
                          {w.name}
                        </span>
                      </th>
                    ))}
                  <th className="relative px-3 py-2 select-none" style={{ width: colW.expiry }}>
                    <button
                      type="button"
                      className="flex items-center gap-1 pr-2"
                      onClick={() => {
                        if (sortBy === 'expiry') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else {
                          setSortBy('expiry');
                          setSortDir('asc');
                        }
                      }}
                    >
                      <span className="truncate">效期</span>
                      <span className="text-[10px] text-muted">
                        {sortBy === 'expiry' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="調整「效期」欄寬（拖曳後會記住）"
                      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-brand-primary/15 active:bg-brand-primary/25"
                      onMouseDown={(e) => onResizeStart('expiry', e)}
                    />
                  </th>
                  {(
                    [
                      ['spec', '規格'],
                      ['actions', '操作'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className={[
                        'relative px-3 py-2 select-none',
                        key === 'actions' ? 'sticky right-0 z-[1] bg-table-head text-right' : '',
                      ].join(' ')}
                      style={{ width: colW[key] }}
                    >
                      {key === 'spec' ? (
                        <div className="flex flex-col items-start gap-1 pr-2">
                          <span>規格</span>
                          <button
                            type="button"
                            className="text-[10px] font-normal text-brand-primary hover:underline"
                            onClick={() => setShowSpecDetail((v) => !v)}
                          >
                            {showSpecDetail ? '收合規格' : '展開規格'}
                          </button>
                        </div>
                      ) : (
                        <span className="block truncate pr-2">{label}</span>
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`調整「${label}」欄寬（拖曳後會記住）`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-brand-primary/15 active:bg-brand-primary/25"
                        onMouseDown={(e) => onResizeStart(key, e)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => (
                  <tr key={p.id} className="group border-t border-slate-100 hover:bg-table-head">
                    <td className="sticky left-0 z-[1] bg-white px-3 py-2 group-hover:bg-table-head">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        aria-label={`選取 ${p.sku}`}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td
                      className="sticky z-[1] bg-white px-3 py-2 font-mono text-xs truncate group-hover:bg-table-head"
                      style={{ left: 44 }}
                      title={p.sku}
                    >
                      {p.sku}
                    </td>
                    <td
                      className="sticky z-[1] bg-white px-3 py-2 truncate group-hover:bg-table-head"
                      style={{ left: 44 + colW.sku }}
                      title={p.name + (p.description ? ` — ${p.description}` : '')}
                    >
                      {p.name}
                    </td>
                    <td className="px-3 py-2 truncate text-xs text-muted" title={categoryName(p.categoryId)}>
                      {categoryName(p.categoryId)}
                    </td>
                    <td className="px-3 py-2 truncate text-xs text-muted" title={brandName(p.brandId)}>
                      {brandName(p.brandId)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{p.listPrice ?? '0'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{p.salePrice ?? '0'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{p.costPrice ?? '—'}</td>
                    <td
                      className="px-3 py-2 text-right font-mono text-xs"
                      title="全倉加總"
                    >
                      {stockByProduct[p.id] ?? 0}
                    </td>
                    {showWhDetail &&
                      warehousesOrdered.map((w, i) => (
                        <td
                          key={w.id}
                          className="px-2 py-2 text-center font-mono text-xs align-middle"
                          style={{ width: whColWidths[i] }}
                          title={`${w.name}：${stockByProductWarehouse[p.id]?.[w.id] ?? 0}`}
                        >
                          {stockByProductWarehouse[p.id]?.[w.id] ?? 0}
                        </td>
                      ))}
                    <td className="px-3 py-2 text-xs text-muted truncate" title={p.expiryDescription ?? undefined}>
                      {p.expiryDescription?.trim() || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {showSpecDetail ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted">尺寸</span>
                            <span className="font-mono text-xs text-content">{p.specSize?.trim() || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted">容量</span>
                            <span className="font-mono text-xs text-content">{p.specCapacity?.trim() || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted">重量</span>
                            <span className="font-mono text-xs text-content">{p.specWeight?.trim() || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted">款式</span>
                            <span className="font-mono text-xs text-content">{p.specStyle?.trim() || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-[1] bg-white px-3 py-2 whitespace-nowrap text-right group-hover:bg-table-head">
                      <button
                        type="button"
                        className="mr-2 text-brand-primary text-xs font-medium hover:underline"
                        onClick={() => openEdit(p)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs font-medium hover:underline"
                        onClick={() => void onDelete(p.id)}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FloatBar：批次改價 */}
        <StandardFloatBar visible={selectedCount > 0} className="w-[min(720px,calc(100%-24px))]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-content">已選 {selectedCount} 筆</span>
            <div className="flex items-end gap-2">
              <label className="text-xs text-muted">
                <span className="mb-1 block">新售價</span>
                <input
                  type="number"
                  min={0}
                  className="h-9 w-40 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="例如 120"
                  value={bulkSalePrice}
                  onChange={(e) => setBulkSalePrice(e.target.value)}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={bulkSubmitting || !bulkSalePrice.trim() || !canWrite}
                onClick={async () => {
                  const salePrice = bulkSalePrice.trim();
                  if (!salePrice) return;
                  setBulkSubmitting(true);
                  const out = await batchUpdateProductPrice({
                    productIds: Array.from(selectedIds),
                    salePrice,
                  });
                  setBulkSubmitting(false);
                  if ('statusCode' in out) {
                    const sc = out.statusCode;
                    if (sc === 404 || sc === 501) {
                      showToast('批次改價 API 即將上線', 'err');
                    } else {
                      showToast(getErrorMessage(out), 'err');
                    }
                    return;
                  }
                  showToast(`已批次更新 ${out.updated} 筆`, 'ok');
                  setSelectedIds(new Set());
                  setBulkSalePrice('');
                  await load();
                }}
              >
                {bulkSubmitting ? '送出中…' : '批次改價'}
              </Button>
              {!canWrite ? <div className="text-xs text-muted">{ADMIN_KEY_REQUIRED_HINT}</div> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedIds(new Set());
                  setBulkSalePrice('');
                }}
              >
                清除選取
              </Button>
            </div>
          </div>
        </StandardFloatBar>

        {/* 右側懸浮抽屜：向左展開 */}
        <aside
          className={`fixed right-0 top-0 z-[100] flex h-full max-h-screen w-full max-w-[440px] flex-col border-l border-brand-surface bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
            panelOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
          aria-label="商品表單"
          aria-hidden={!panelOpen}
        >
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-4 pt-14">
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-2 border-b border-brand-surface bg-white px-3 py-2.5">
              <span className="truncate text-sm font-semibold text-content">
                {editing && !creating ? `編輯：${editing.sku}` : '新增商品'}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {editing && !creating && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-primary hover:underline"
                    onClick={openCreate}
                  >
                    改為新增
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg border border-brand-surface px-2 py-1 text-xs font-medium text-[#64748b] hover:bg-table-head"
                  onClick={() => setPanelOpen(false)}
                  aria-label="收起表單"
                >
                  收起
                </button>
              </div>
            </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    基本
                  </p>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <TextInput
                      label="SKU"
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                      required
                    />
                    <TextInput
                      label="名稱"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    歸屬
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748b]">類別</label>
                      <select
                        className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        value={form.categoryId}
                        onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                      >
                        <option value="">—</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748b]">品牌</label>
                      <select
                        className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        value={form.brandId}
                        onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                      >
                        <option value="">—</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    規格與效期
                  </p>
                  {editing && (
                    <div className="mb-3 rounded-lg border border-brand-surface bg-table-head p-2">
                      <div className="mb-1 text-[11px] font-semibold text-muted">庫存餘額（快捷）</div>
                      <div className="flex flex-wrap gap-3 text-[11px]">
                        <span className="rounded bg-white px-2 py-1 shadow-sm">
                          <span className="text-muted">全倉</span>
                          <span className="ml-2 font-mono font-semibold tabular-nums text-content">
                            {stockByProduct[editing.id] ?? 0}
                          </span>
                        </span>
                        {warehousesOrdered.slice(0, 6).map((w) => (
                          <span key={w.id} className="rounded bg-white px-2 py-1 shadow-sm" title={w.name}>
                            <span className="text-muted">{w.name}</span>
                            <span className="ml-2 font-mono tabular-nums text-content">
                              {stockByProductWarehouse[editing.id]?.[w.id] ?? 0}
                            </span>
                          </span>
                        ))}
                        {warehousesOrdered.length > 6 && (
                          <span className="text-muted">…其餘 {warehousesOrdered.length - 6} 倉</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextInput
                      label="尺寸 (specSize)"
                      value={form.specSize}
                      onChange={(e) => setForm((f) => ({ ...f, specSize: e.target.value }))}
                      placeholder=""
                    />
                    <TextInput
                      label="容量 (specCapacity)"
                      value={form.specCapacity}
                      onChange={(e) => setForm((f) => ({ ...f, specCapacity: e.target.value }))}
                      placeholder=""
                    />
                    <TextInput
                      label="重量 (specWeight)"
                      value={form.specWeight}
                      onChange={(e) => setForm((f) => ({ ...f, specWeight: e.target.value }))}
                      placeholder=""
                    />
                    <TextInput
                      label="款式 (specStyle)"
                      value={form.specStyle}
                      onChange={(e) => setForm((f) => ({ ...f, specStyle: e.target.value }))}
                      placeholder=""
                    />
                    <TextInput
                      label="保存說明（非效期日）(expiryDescription)"
                      value={form.expiryDescription}
                      onChange={(e) => setForm((f) => ({ ...f, expiryDescription: e.target.value }))}
                      placeholder=""
                    />
                  </div>
                    {editing && (
                      <div className="mt-3 rounded-lg border border-dashed border-[#cbd5f5] bg-white/70 p-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#475569]">
                            近 30 天即將到期批次
                          </span>
                          {expiringLoading && (
                            <span className="text-[11px] text-[#94a3b8]">載入中…</span>
                          )}
                        </div>
                        {expiringError && (
                          <p className="text-[11px] text-red-600">
                            無法載入批次：{expiringError}
                          </p>
                        )}
                        {!expiringError &&
                          !expiringLoading &&
                          (!expiringBatches || expiringBatches.length === 0) && (
                            <p className="text-[11px] text-[#94a3b8]">
                              目前沒有設定效期的庫存批次。
                            </p>
                          )}
                        {!expiringError && expiringBatches && expiringBatches.length > 0 && (
                          <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-brand-surface bg-table-head">
                            <table className="w-full border-collapse text-[11px]">
                              <thead className="bg-brand-surface text-[#475569]">
                                <tr>
                                  <th className="px-2 py-1 text-left">批號</th>
                                  <th className="px-2 py-1 text-left">效期日</th>
                                  <th className="px-2 py-1 text-right">庫存數</th>
                                  <th className="px-2 py-1 text-left">倉庫</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expiringBatches.map((b) => (
                                  <tr
                                    key={`${b.productId}-${b.warehouseId}-${b.batchCode ?? 'none'}-${b.expiryDate}`}
                                    className="border-t border-brand-surface"
                                  >
                                    <td className="px-2 py-1 font-mono">
                                      {b.batchCode || '—'}
                                    </td>
                                    <td className="px-2 py-1">
                                      {b.expiryDate?.slice(0, 10)}
                                    </td>
                                    <td className="px-2 py-1 text-right font-mono">
                                      {b.onHandQty}
                                    </td>
                                    <td className="px-2 py-1 text-xs text-[#64748b]">
                                      {b.warehouseId}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    價格
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextInput
                      label="定價"
                      value={form.listPrice}
                      onChange={(e) => setForm((f) => ({ ...f, listPrice: e.target.value }))}
                      className="text-right tabular-nums"
                    />
                    <TextInput
                      label="售價"
                      value={form.salePrice}
                      onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                      className="text-right tabular-nums"
                    />
                    <TextInput
                      label="成本（可空）"
                      value={form.costPrice}
                      onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                      className="sm:col-span-2 text-right tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    描述
                  </p>
                  <TextInput
                    label="描述"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                  標籤（可多選）
                </label>
                <p className="text-[11px] text-[#94a3b8]">
                  用來在報表與列表中快速篩選；選項來自 GET /product-tags。
                </p>
                <select
                  multiple
                  size={Math.min(6, tagOptions.length + 1)}
                  className="w-full min-h-[100px] rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm text-content focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={form.tags}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setForm((f) => ({ ...f, tags: selected }));
                  }}
                >
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#94a3b8]">
                  按住 Ctrl（Windows）或 Cmd（Mac）可多選
                </p>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-brand-surface pt-3">
                <Button type="submit">儲存</Button>
                <Button type="button" variant="secondary" onClick={openCreate}>
                  {editing && !creating ? '取消編輯' : '清空表單'}
                </Button>
              </div>
            </form>
        </aside>
      </div>
    </div>
  );
};
