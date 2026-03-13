import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { usePosCart, POS_TAX_RATE } from '../modules/pos/usePosCart';
import type { PosProduct, PosProductDisplay } from '../modules/pos/types';
import { PosCheckoutModal } from './PosCheckoutModal';
import type { CreateOrderResult, CategoryDto, BrandDto } from '../modules/pos/posOrdersApi';
import {
  getStores,
  getProducts,
  getCategories,
  getBrands,
  getWarehouses,
} from '../modules/pos/posOrdersApi';

const ALL_ID = '';

/** 與後端 Product.tags / seed 一致；選「無」不帶 tag query */
const DISCOUNT_TAG_OPTIONS: { tag: string; name: string }[] = [
  { tag: '', name: '無' },
  { tag: '促銷中', name: '促銷中' },
  { tag: '熱賣', name: '熱賣' },
  { tag: '會員價', name: '會員價' },
];

const mockProducts: PosProductDisplay[] = Array.from({ length: 16 }).map((_, index) => {
  const categoryIds = ['cat-1', 'cat-2', 'cat-3'];
  const categoryId = categoryIds[index % categoryIds.length];
  const brandId = `brand-${(index % 3) + 1}`;
  const tags: string[] = [];
  if (index % 3 === 0) tags.push('促銷中');
  if (index % 4 === 0) tags.push('熱賣');
  if (index % 5 === 0) tags.push('會員價');
  return {
    id: `p${index + 1}`,
    name: `示意商品 ${index + 1}`,
    price: 120 + index * 10,
    sku: `SKU-${String(index + 1).padStart(3, '0')}`,
    categoryId,
    brandId,
    tags,
  };
});

export const PosPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, summary, addProduct, changeQuantity, clearCart } = usePosCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<CreateOrderResult | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedDiscountTag, setSelectedDiscountTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState<3 | 4 | 5>(5);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [apiStoreId, setApiStoreId] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<PosProductDisplay[] | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);

  const loadProducts = async (opts?: { categoryId?: string; brandId?: string; tag?: string }) => {
    const productsRes = await getProducts(opts);
    if (Array.isArray(productsRes)) {
      setApiProducts(
        productsRes.map((p) => ({
          id: p.id,
          name: p.name,
          price: 100,
          sku: p.sku,
          categoryId: p.categoryId,
          brandId: p.brandId,
          tags: p.tags ?? [],
        })),
      );
      setApiLoadError(null);
    } else {
      setApiLoadError(productsRes.message ?? '無法載入商品');
      setApiProducts(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setApiLoadError(null);
      const [storesRes, categoriesRes, brandsRes, productsRes] = await Promise.all([
        getStores(),
        getCategories(),
        getBrands(),
        getProducts(),
      ]);
      if (!mounted) return;
      if (Array.isArray(storesRes) && storesRes.length > 0) {
        let chosen: string | null = null;
        const withWh = storesRes.find((s) => (s.warehouseIds?.length ?? 0) > 0);
        if (withWh) chosen = withWh.id;
        else {
          const wh = await getWarehouses();
          if (Array.isArray(wh)) {
            const linked = wh.find((w) => w.storeId);
            if (linked?.storeId) chosen = linked.storeId;
          }
        }
        setApiStoreId(chosen ?? storesRes[0].id);
      }
      else if (!Array.isArray(storesRes)) setApiLoadError(storesRes.message ?? '無法載入門市');
      if (Array.isArray(categoriesRes) && categoriesRes.length > 0) setCategories(categoriesRes);
      if (Array.isArray(brandsRes)) setBrands(brandsRes);
      if (Array.isArray(productsRes)) {
        setApiProducts(
          productsRes.map((p) => ({
            id: p.id,
            name: p.name,
            price: 100,
            sku: p.sku,
            categoryId: p.categoryId,
            brandId: p.brandId,
            tags: p.tags ?? [],
          })),
        );
      } else if (productsRes && !Array.isArray(productsRes)) {
        setApiLoadError((productsRes as { message?: string }).message ?? '無法載入商品');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const storeId = apiStoreId ?? '';
  const productsForGrid = apiProducts ?? mockProducts;
  const brandList: { id: string; name: string }[] = [{ id: ALL_ID, name: '全部' }, ...brands.map((b) => ({ id: b.id, name: b.name }))];

  const filteredProducts = useMemo(() => {
    let list = productsForGrid;
    if (selectedCategoryIds.length > 0) {
      list = list.filter((p) => p.categoryId && selectedCategoryIds.includes(p.categoryId));
    }
    if (selectedBrandIds.length > 0) {
      list = list.filter((p) => p.brandId && selectedBrandIds.includes(p.brandId));
    }
    /* 折扣由 API tag 篩選；mock 離線時於此補過濾 */
    if (apiProducts === null && selectedDiscountTag) {
      list = list.filter((p) => p.tags?.includes(selectedDiscountTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [productsForGrid, selectedCategoryIds, selectedBrandIds, selectedDiscountTag, searchQuery, apiProducts]);

  const clearFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedBrandIds([]);
    setSelectedDiscountTag('');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCategoryIds.length > 0 ||
    selectedBrandIds.length > 0 ||
    selectedDiscountTag !== '' ||
    searchQuery.trim() !== '';

  const gridClass =
    gridCols === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : gridCols === 4
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            POS
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">門市收銀工作區</div>
            <div className="text-xs text-slate-500">
              {apiStoreId ? '已連線後端門市與商品' : apiLoadError ?? '載入中…'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:gap-3">
          <button
            type="button"
            data-testid="e2e-nav-orders"
            onClick={() => navigate('/pos/orders')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            今日訂單
          </button>
          <button
            type="button"
            data-testid="e2e-nav-admin-inventory"
            onClick={() => navigate('/admin/inventory')}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
          >
            庫存（後台）
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            線上 · 已連線伺服器
          </span>
          <span>2026-03-13</span>
        </div>
      </header>

      {/* 小於 lg：單欄 + 購物車固定底部（圖1）；lg 起才側欄並排（圖2） */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-[calc(14rem+env(safe-area-inset-bottom))] pt-3 sm:gap-4 sm:px-4 lg:flex-row lg:pb-4 lg:pl-4">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-white p-2 shadow-sm shadow-slate-200 sm:p-3 lg:min-w-0 lg:flex-[3]">
          <div className="mb-3 grid grid-cols-1 gap-2 min-[640px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-[640px]:grid-rows-[auto_auto]">
            <div className="rounded-2xl bg-slate-50 px-3 py-2 min-[640px]:row-span-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-700">篩選</div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-medium text-slate-500">品項</span>
                {[{ id: ALL_ID, name: '全部' }, ...categories].map((c) => {
                  const selected =
                    c.id === ALL_ID ? selectedCategoryIds.length === 0 : selectedCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={async () => {
                        const nextSelected = c.id === ALL_ID ? [] : [c.id];
                        setSelectedCategoryIds(nextSelected);
                        const cat = c.id === ALL_ID ? undefined : c.id;
                        await loadProducts({
                          categoryId: cat,
                          brandId: selectedBrandIds.length === 1 ? selectedBrandIds[0] : undefined,
                          tag: selectedDiscountTag || undefined,
                        });
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-medium text-slate-500">品牌</span>
                {brandList.map((b) => {
                  const id = b.id;
                  const selected =
                    id === ALL_ID ? selectedBrandIds.length === 0 : selectedBrandIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={async () => {
                        const next = id === ALL_ID ? [] : [id];
                        setSelectedBrandIds(next);
                        await loadProducts({
                          categoryId: selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined,
                          brandId: id === ALL_ID ? undefined : id,
                          tag: selectedDiscountTag || undefined,
                        });
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-medium text-slate-500">折扣</span>
                {DISCOUNT_TAG_OPTIONS.map((d) => {
                  const selected = selectedDiscountTag === d.tag;
                  return (
                    <button
                      key={d.tag || 'none'}
                      type="button"
                      data-testid={d.tag ? `pos-filter-tag-${d.tag}` : 'pos-filter-tag-none'}
                      onClick={async () => {
                        setSelectedDiscountTag(d.tag);
                        await loadProducts({
                          categoryId: selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined,
                          brandId: selectedBrandIds.length === 1 ? selectedBrandIds[0] : undefined,
                          tag: d.tag || undefined,
                        });
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>共 {filteredProducts.length} 件</span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={async () => {
                      clearFilters();
                      await loadProducts();
                    }}
                    className="text-[11px] font-medium text-slate-500 underline hover:text-slate-700"
                  >
                    清除篩選
                  </button>
                )}
              </div>
            </div>

            {/* 搜尋、欄數：各一塊卡片，上下排列 */}
            <div className="flex min-w-0 flex-col gap-2 min-[640px]:contents">
              <div className="flex items-center rounded-2xl bg-slate-50 px-3 py-2 min-[640px]:col-start-2 min-[640px]:row-start-1">
                <div className="relative w-full min-w-0">
                  <input
                    type="search"
                    placeholder="搜尋商品或掃條碼..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                    ⌘K
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] min-[640px]:col-start-2 min-[640px]:row-start-2">
                <span className="mr-1 shrink-0 text-slate-500">欄數</span>
                {([3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGridCols(n)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      gridCols === n ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
            </div>
          </div>

          {apiLoadError && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              {apiLoadError}，結帳將使用 mock 資料；若後端已啟動請重新整理。
            </div>
          )}
          {/* content-start + 固定卡高：與 3 欄時相同高度，不因欄數或少筆商品而撐滿整區 */}
          <div
            className={`grid min-h-[min(50vh,380px)] flex-1 content-start gap-2 overflow-y-auto rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2 auto-rows-auto ${gridClass}`}
          >
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                data-testid={`pos-product-${product.id}`}
                data-product-name={product.name}
                onClick={() => addProduct(product as PosProduct)}
                className="flex h-[118px] w-full min-w-0 shrink-0 flex-col items-start gap-0.5 rounded-lg bg-white px-2 py-1.5 text-left text-[11px] shadow-sm shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-sky-50 sm:h-[120px]"
              >
                {product.sku && (
                  <span className="shrink-0 text-[10px] text-slate-400">{product.sku}</span>
                )}
                <span className="line-clamp-2 min-h-0 flex-1 font-medium leading-snug text-slate-900">
                  {product.name}
                </span>
                <span className="shrink-0 text-sky-700">${product.price}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="fixed bottom-0 left-0 right-0 z-20 max-h-[42vh] w-full border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:static lg:z-0 lg:max-h-none lg:w-[340px] lg:shrink-0 lg:self-stretch lg:border-t-0 lg:shadow-sm lg:rounded-2xl lg:pb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">購物車</span>
            <Button type="button" size="sm" variant="secondary" onClick={clearCart}>
              清空
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
            {items.length === 0 ? (
              <div className="py-8 text-center text-slate-400">尚無品項</div>
            ) : (
              items.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{line.name}</div>
                    <div className="text-[10px] text-slate-500">
                      ${line.unitPrice} × {line.quantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                      onClick={() => changeQuantity(line.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                      onClick={() => changeQuantity(line.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>小計</span>
              <span className="tabular-nums">${summary.subtotal.toLocaleString()}</span>
            </div>
            {POS_TAX_RATE > 0 && (
              <div className="flex justify-between">
                <span>稅額 ({Math.round(POS_TAX_RATE * 100)}%)</span>
                <span className="tabular-nums">${summary.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900">
              <span>應收</span>
              <span className="tabular-nums">${summary.total.toLocaleString()}</span>
            </div>
          </div>
          <Button
            type="button"
            fullWidth
            className="mt-3"
            variant="primary"
            data-testid="e2e-checkout-open"
            disabled={!items.length || !storeId}
            onClick={() => setCheckoutOpen(true)}
          >
            前往結帳
          </Button>
          {lastOrderResult?.body && (
            <div className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-800">
              最近單號 {lastOrderResult.body.orderNumber}
              {lastOrderResult.body.credit ? '（掛帳）' : ''}
            </div>
          )}
        </section>
      </main>

      <PosCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={items}
        totalAmount={summary.total}
        storeId={storeId}
        onOrderCreated={setLastOrderResult}
      />
    </div>
  );
};
