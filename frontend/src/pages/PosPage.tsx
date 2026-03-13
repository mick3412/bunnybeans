import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { usePosCart } from '../modules/pos/usePosCart';
import type { PosProduct, PosProductDisplay } from '../modules/pos/types';
import { PosCheckoutModal } from './PosCheckoutModal';
import type { CreateOrderResult, CategoryDto, BrandDto } from '../modules/pos/posOrdersApi';
import { getStores, getProducts, getCategories, getBrands } from '../modules/pos/posOrdersApi';

const ALL_ID = '';

const mockDiscountOptions = [
  { id: ALL_ID, name: '無' },
  { id: 'promo', name: '促銷中' },
  { id: 'hot', name: '熱賣' },
  { id: 'member', name: '會員價' },
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

function toggleSet(set: string[], id: string, allId: string): string[] {
  if (id === allId) return [];
  if (set.includes(id)) return set.filter((x) => x !== id);
  return [...set, id];
}

export const PosPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, summary, addProduct, changeQuantity, clearCart } = usePosCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<CreateOrderResult | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState<3 | 4 | 5>(5);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [apiStoreId, setApiStoreId] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<PosProductDisplay[] | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);

  const loadProducts = async (opts?: { categoryId?: string; brandId?: string }) => {
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
      if (Array.isArray(storesRes) && storesRes.length > 0) setApiStoreId(storesRes[0].id);
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
    const tagToId = (t: string) => (t === '促銷中' ? 'promo' : t === '熱賣' ? 'hot' : t === '會員價' ? 'member' : t);
    if (selectedDiscountIds.length > 0) {
      list = list.filter((p) => p.tags && p.tags.some((t) => selectedDiscountIds.includes(tagToId(t))));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [productsForGrid, selectedCategoryIds, selectedBrandIds, selectedDiscountIds, searchQuery]);

  const clearFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedBrandIds([]);
    setSelectedDiscountIds([]);
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCategoryIds.length > 0 || selectedBrandIds.length > 0 || selectedDiscountIds.length > 0 || searchQuery.trim() !== '';

  const categoryIdForApi = selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined;
  const brandIdForApi = selectedBrandIds.length === 1 ? selectedBrandIds[0] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
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
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => navigate('/pos/orders')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            今日訂單
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            線上 · 已連線伺服器
          </span>
          <span>2026-03-13</span>
        </div>
      </header>

      <main className="flex flex-1 gap-4 px-4 pb-4 pt-3">
        <section className="flex min-w-0 flex-[3] flex-col rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
          <div className="mb-3 grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_auto] gap-3">
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
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
                {mockDiscountOptions.map((d) => {
                  const selected =
                    d.id === ALL_ID ? selectedDiscountIds.length === 0 : selectedDiscountIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        setSelectedDiscountIds(d.id === ALL_ID ? [] : toggleSet(selectedDiscountIds, d.id, ALL_ID))
                      }
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

            <div className="flex items-center justify-end rounded-2xl bg-slate-50 px-3 py-2">
              <div className="relative w-full max-w-xs">
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

            <div className="flex items-center justify-end gap-1 rounded-2xl bg-slate-50 px-3 py-2 text-[11px]">
              <span className="mr-1 text-slate-500">欄數</span>
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

          {apiLoadError && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              {apiLoadError}，結帳將使用 mock 資料；若後端已啟動請重新整理。
            </div>
          )}
          <div
            className={`grid min-h-[280px] max-h-[60vh] auto-rows-[minmax(120px,auto)] gap-2 overflow-y-auto rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2 ${
              gridCols === 3 ? 'grid-cols-3' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-5'
            }`}
          >
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product as PosProduct)}
                className="flex min-h-[120px] min-w-[100px] flex-col items-start gap-0.5 rounded-lg bg-white px-2 py-1.5 text-left text-[11px] shadow-sm shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-sky-50"
              >
                {product.sku && (
                  <span className="text-[10px] text-slate-400">{product.sku}</span>
                )}
                <span className="line-clamp-2 font-medium text-slate-900">{product.name}</span>
                <span className="mt-auto text-sky-700">${product.price}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex w-[340px] shrink-0 flex-col rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
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
                  key={line.productId}
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
                      onClick={() => changeQuantity(line.productId, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                      onClick={() => changeQuantity(line.productId, line.quantity + 1)}
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
            <div className="flex justify-between">
              <span>稅額 (5%)</span>
              <span className="tabular-nums">${summary.tax.toLocaleString()}</span>
            </div>
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
