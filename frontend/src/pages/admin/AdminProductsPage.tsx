import React, { useEffect, useMemo, useState } from 'react';
import { usePersistentTableColumnWidths } from '../../shared/hooks/usePersistentTableColumnWidths';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getBrands,
  getInventoryBalances,
  getWarehouses,
  type ProductFullDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { TextInput } from '../../shared/components/TextInput';

const PRODUCTS_TABLE_COL_STORAGE = 'admin-products-table-col-widths';
const PRODUCTS_TABLE_COL_DEFAULTS = {
  sku: 120,
  name: 200,
  salePrice: 80,
  stock: 104,
  spec: 120,
  actions: 120,
} as const;

/** 依倉庫名稱字數估算欄寬（px） */
function warehouseColWidthPx(name: string): number {
  const n = [...name].length || 1;
  return Math.min(220, Math.max(100, 12 * n + 28));
}

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductFullDto[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  /** productId -> warehouseId -> onHandQty */
  const [stockByProductWarehouse, setStockByProductWarehouse] = useState<
    Record<string, Record<string, number>>
  >({});
  const [warehousesOrdered, setWarehousesOrdered] = useState<{ id: string; name: string }[]>([]);
  /** false = 僅總庫存；true = 總庫存 + 各倉欄 */
  const [showWhDetail, setShowWhDetail] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductFullDto | null>(null);
  /** 常駐右欄：true = 新增表單；false 且 editing 有值 = 編輯該列 */
  const [creating, setCreating] = useState(true);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    specSize: '',
    specColor: '',
    weightGrams: '',
    listPrice: '0',
    salePrice: '0',
    costPrice: '',
    categoryId: '',
    brandId: '',
    tags: '',
  });

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

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({
      sku: '',
      name: '',
      description: '',
      specSize: '',
      specColor: '',
      weightGrams: '',
      listPrice: '0',
      salePrice: '0',
      costPrice: '',
      categoryId: '',
      brandId: '',
      tags: '',
    });
  };

  const openEdit = (row: ProductFullDto) => {
    setEditing(row);
    setCreating(false);
    setForm({
      sku: row.sku,
      name: row.name,
      description: row.description ?? '',
      specSize: row.specSize ?? '',
      specColor: row.specColor ?? '',
      weightGrams: row.weightGrams != null ? String(row.weightGrams) : '',
      listPrice: row.listPrice ?? '0',
      salePrice: row.salePrice ?? '0',
      costPrice: row.costPrice ?? '',
      categoryId: row.categoryId ?? '',
      brandId: row.brandId ?? '',
      tags: (row.tags ?? []).join(', '),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const tags = form.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const weightGrams =
      form.weightGrams.trim() === '' ? null : parseInt(form.weightGrams, 10);
    const body = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      specSize: form.specSize.trim() || null,
      specColor: form.specColor.trim() || null,
      weightGrams: Number.isFinite(weightGrams as number) ? weightGrams : null,
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
        setErr(getErrorMessage(out as ApiError));
        return;
      }
    } else {
      const out = await updateProduct(editing.id, body);
      if ('statusCode' in out) {
        setErr(getErrorMessage(out as ApiError));
        return;
      }
    }
    await load();
    openCreate();
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
    colW.salePrice +
    colW.stock +
    whColsSum +
    colW.spec +
    colW.actions;

  const onDelete = async (id: string) => {
    if (!confirm('確定刪除此商品？（若有庫存事件請先確認）')) return;
    const out = await deleteProduct(id);
    if ('statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    if (editing?.id === id) openCreate();
    await load();
  };

  return (
    <div className="min-w-0 max-w-[1600px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">商品主檔</h1>
          <p className="text-sm text-slate-500">
            與 POS 共用主檔 API；庫存唯讀。預設僅總庫存；可展開各倉現量。
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          新增商品
        </Button>
      </div>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* 左：表格 */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table
              className="table-fixed text-left text-sm"
              style={{ width: tableMinWidth, minWidth: '100%' }}
            >
              <colgroup>
                <col style={{ width: colW.sku }} />
                <col style={{ width: colW.name }} />
                <col style={{ width: colW.salePrice }} />
                <col style={{ width: colW.stock }} />
                {showWhDetail &&
                  warehousesOrdered.map((w, i) => (
                    <col key={w.id} style={{ width: whColWidths[i] }} />
                  ))}
                <col style={{ width: colW.spec }} />
                <col style={{ width: colW.actions }} />
              </colgroup>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {(
                    [
                      ['sku', 'SKU'],
                      ['name', '名稱'],
                      ['salePrice', '售價'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className="relative px-3 py-2 select-none"
                      style={{ width: colW[key] }}
                    >
                      <span className="block truncate pr-2">{label}</span>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`調整「${label}」欄寬（拖曳後會記住）`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-violet-200/60 active:bg-violet-300/80"
                        onMouseDown={(e) => onResizeStart(key, e)}
                      />
                    </th>
                  ))}
                  <th
                    className="relative px-3 py-2 select-none text-right"
                    style={{ width: colW.stock }}
                  >
                    <div className="flex flex-col items-end gap-1 pr-2">
                      <span>總庫存</span>
                      <button
                        type="button"
                        className="text-[10px] font-normal text-violet-600 hover:underline"
                        onClick={() => setShowWhDetail((v) => !v)}
                      >
                        {showWhDetail ? '收合各倉' : '展開各倉'}
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="調整「總庫存」欄寬（拖曳後會記住）"
                      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-violet-200/60 active:bg-violet-300/80"
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
                  {(
                    [
                      ['spec', '規格'],
                      ['actions', '操作'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className="relative px-3 py-2 select-none"
                      style={{ width: colW[key] }}
                    >
                      <span className="block truncate pr-2">{label}</span>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`調整「${label}」欄寬（拖曳後會記住）`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-violet-200/60 active:bg-violet-300/80"
                        onMouseDown={(e) => onResizeStart(key, e)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs truncate" title={p.sku}>
                      {p.sku}
                    </td>
                    <td
                      className="px-3 py-2 truncate"
                      title={p.name + (p.description ? ` — ${p.description}` : '')}
                    >
                      {p.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.salePrice ?? '0'}</td>
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
                    <td className="px-3 py-2 text-xs text-slate-500 truncate">
                      {[p.specSize, p.specColor].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="mr-2 text-violet-600 text-xs font-medium hover:underline"
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

        {/* 右：常駐新增／編輯 */}
        <aside
          className="w-full shrink-0 rounded-xl border border-violet-200 bg-violet-50/60 shadow-sm lg:sticky lg:top-4 lg:w-[400px] xl:w-[440px] lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto"
          aria-label="商品表單"
        >
          <form onSubmit={submit} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/80 pb-2">
              <span className="text-sm font-semibold text-violet-900">
                {editing && !creating ? `編輯：${editing.sku}` : '新增商品'}
              </span>
              {editing && !creating && (
                <button
                  type="button"
                  className="text-xs font-medium text-violet-600 hover:underline"
                  onClick={openCreate}
                >
                  改為新增
                </button>
              )}
            </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
              <TextInput
                label="描述"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <TextInput
                  label="規格尺寸"
                  value={form.specSize}
                  onChange={(e) => setForm((f) => ({ ...f, specSize: e.target.value }))}
                />
                <TextInput
                  label="款式"
                  value={form.specColor}
                  onChange={(e) => setForm((f) => ({ ...f, specColor: e.target.value }))}
                />
                <TextInput
                  label="重量 (g)"
                  value={form.weightGrams}
                  onChange={(e) => setForm((f) => ({ ...f, weightGrams: e.target.value }))}
                  placeholder="整數"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <TextInput
                  label="定價"
                  value={form.listPrice}
                  onChange={(e) => setForm((f) => ({ ...f, listPrice: e.target.value }))}
                />
                <TextInput
                  label="售價"
                  value={form.salePrice}
                  onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                />
                <TextInput
                  label="成本（可空）"
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">分類</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">品牌</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
              <TextInput
                label="標籤（逗號分隔）"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="促銷中, 熱賣"
              />
              <div className="flex flex-wrap gap-2 border-t border-violet-200/80 pt-3">
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
