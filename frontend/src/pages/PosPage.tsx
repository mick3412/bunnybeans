import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { usePosCart } from '../modules/pos/usePosCart';
import type { PosProduct, PosProductDisplay } from '../modules/pos/types';
import { PosCheckoutModal } from './PosCheckoutModal';
import type { CreateOrderResult } from '../modules/pos/posOrdersApi';
import { getStores, getProducts } from '../modules/pos/posOrdersApi';

const ALL_ID = '';

const mockCategories = [
  { id: ALL_ID, name: '全部' },
  { id: 'cat-clothes', name: '衣服' },
  { id: 'cat-hay', name: '牧草' },
  { id: 'cat-feed', name: '飼料' },
  { id: 'cat-supplies', name: '用品' },
];

const mockBrands = [
  { id: ALL_ID, name: '全部' },
  { id: 'brand-a', name: '品牌 A' },
  { id: 'brand-b', name: '品牌 B' },
  { id: 'brand-c', name: '品牌 C' },
];

const mockDiscountOptions = [
  { id: ALL_ID, name: '無' },
  { id: 'promo', name: '促銷中' },
  { id: 'hot', name: '熱賣' },
  { id: 'member', name: '會員價' },
];

const categoryIds = mockCategories.filter((c) => c.id !== ALL_ID).map((c) => c.id);
const brandIds = mockBrands.filter((b) => b.id !== ALL_ID).map((b) => b.id);

const mockProducts: PosProductDisplay[] = Array.from({ length: 16 }).map((_, index) => {
  const categoryId = categoryIds[index % categoryIds.length];
  const brandId = brandIds[index % brandIds.length];
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
  const [apiStoreId, setApiStoreId] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<PosProductDisplay[] | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setApiLoadError(null);
      const [storesRes, productsRes] = await Promise.all([getStores(), getProducts()]);
      if (!mounted) return;
      if (Array.isArray(storesRes) && storesRes.length > 0) setApiStoreId(storesRes[0].id);
      else if (!Array.isArray(storesRes)) setApiLoadError(storesRes.message ?? '無法載入門市');
      if (Array.isArray(productsRes) && productsRes.length > 0) {
        const categoryIds = mockCategories.filter((c) => c.id !== ALL_ID).map((c) => c.id);
        const brandIds = mockBrands.filter((b) => b.id !== ALL_ID).map((b) => b.id);
        setApiProducts(
          productsRes.map((p, i) => ({
            id: p.id,
            name: p.name,
            price: 100,
            sku: p.sku,
            categoryId: categoryIds[i % categoryIds.length],
            brandId: brandIds[i % brandIds.length],
            tags: i % 3 === 0 ? ['促銷中'] : i % 4 === 0 ? ['熱賣'] : [],
          })),
        );
      } else if (!Array.isArray(productsRes)) {
        setApiLoadError(productsRes.message ?? '無法載入商品');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const storeId = apiStoreId ?? '';
  const productsForGrid = apiProducts ?? mockProducts;

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
        {/* 左側：商品區 */}
        <section className="flex min-w-0 flex-[3] flex-col rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
          <div className="mb-2 flex w-full items-center gap-2">
            <div className="min-w-0 flex-1" aria-hidden />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="order-first shrink-0 text-[11px] font-medium text-slate-500 underline hover:text-slate-700"
              >
                清除篩選
              </button>
            )}
            <div className="relative w-64 shrink-0">
              <input
                type="search"
                placeholder="搜尋商品或掃條碼..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                ⌘K
              </span>
            </div>
          </div>

          {/* 品項 */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-medium text-slate-500">品項</span>
            {mockCategories.map((c) => {
              const selected = c.id === ALL_ID ? selectedCategoryIds.length === 0 : selectedCategoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategoryIds(c.id === ALL_ID ? [] : toggleSet(selectedCategoryIds, c.id, ALL_ID))
                  }
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {/* 品牌 */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-medium text-slate-500">品牌</span>
            {mockBrands.map((b) => {
              const selected = b.id === ALL_ID ? selectedBrandIds.length === 0 : selectedBrandIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBrandIds(b.id === ALL_ID ? [] : toggleSet(selectedBrandIds, b.id, ALL_ID))}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
          {/* 折扣 */}
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-medium text-slate-500">折扣</span>
            {mockDiscountOptions.map((d) => {
              const selected = d.id === ALL_ID ? selectedDiscountIds.length === 0 : selectedDiscountIds.includes(d.id);
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

          {apiLoadError && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              {apiLoadError}，結帳將使用 mock 資料；若後端已啟動請重新整理。
            </div>
          )}
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">共 {filteredProducts.length} 件</span>
            <div className="flex items-center gap-0.5">
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
          <div
            className={`grid min-h-[280px] max-h-[60vh] auto-rows-[minmax(80px,auto)] gap-2 overflow-y-auto rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2 ${
              gridCols === 3 ? 'grid-cols-3' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-5'
            }`}
          >
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product as PosProduct)}
                className="flex min-h-[80px] min-w-[100px] flex-col items-start gap-0.5 rounded-lg bg-white px-2 py-1.5 text-left text-[11px] shadow-sm shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-sky-50"
              >
                {product.sku && (
                  <span className="text-[10px] text-slate-400">{product.sku}</span>
                )}
                <div className="line-clamp-2 font-medium text-slate-900">{product.name}</div>
                <div className="mt-auto flex items-center gap-1">
                  <span className="font-semibold text-sky-700">${product.price.toLocaleString()}</span>
                  {product.tags && product.tags.length > 0 && (
                    <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-800">
                      {product.tags[0]}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 右側：購物車與結帳區 */}
        <section className="flex w-[360px] flex-col rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">目前銷售單</div>
              <div className="text-[11px] text-slate-500">之後會接上會員與促銷規則</div>
            </div>
            <Button type="button" variant="secondary" size="sm">
              暫存單
            </Button>
          </div>

          <div className="flex-1 overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-100/60 px-3 py-1.5 text-[11px] font-medium text-slate-500">
              <span className="w-1/2">品項</span>
              <span className="w-1/6 text-right">數量</span>
              <span className="w-1/6 text-right">單價</span>
              <span className="w-1/6 text-right">小計</span>
            </div>
            {items.length === 0 ? (
              <div className="flex h-[210px] flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-slate-400">
                <span>點選左側商品即可加入購物車。</span>
                <span>下一步會把這裡接上會員與折扣規則。</span>
              </div>
            ) : (
              <div className="h-[210px] overflow-y-auto px-2 py-1.5 text-[11px]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100">
                    <div className="w-1/2">
                      <div className="truncate font-medium text-slate-800">{item.name}</div>
                    </div>
                    <div className="flex w-1/6 items-center justify-end gap-1">
                      <button
                        type="button"
                        className="h-5 w-5 rounded-full bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200"
                        onClick={() => changeQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        -
                      </button>
                      <span className="min-w-[1.5rem] text-right tabular-nums text-slate-800">{item.quantity}</span>
                      <button
                        type="button"
                        className="h-5 w-5 rounded-full bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200"
                        onClick={() => changeQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="w-1/6 text-right tabular-nums text-slate-500">
                      ${item.unitPrice.toLocaleString()}
                    </div>
                    <div className="w-1/6 text-right tabular-nums font-semibold text-slate-800">
                      ${(item.unitPrice * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>小計</span>
              <span>${summary.subtotal.toLocaleString()}</span>
            </div>
            {summary.tax > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>稅額</span>
                <span>${summary.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-base font-semibold">
              <span>應收金額</span>
              <span>${summary.total.toLocaleString()}</span>
            </div>
          </div>

          {lastOrderResult?.body ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              <div className="mb-0.5 font-semibold">最近一筆交易</div>
              <div>單號：{lastOrderResult.body.orderNumber}</div>
              <div>金額：${lastOrderResult.body.totalAmount.toLocaleString()}</div>
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={clearCart}>
              清空
            </Button>
            <Button
              type="button"
              variant="success"
              fullWidth
              onClick={() => setCheckoutOpen(true)}
              disabled={!items.length || !storeId}
            >
              前往結帳
            </Button>
          </div>
        </section>
      </main>
      <PosCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={items}
        totalAmount={summary.total}
        storeId={storeId}
        onOrderCreated={(result) => {
          setLastOrderResult(result);
          if (result.statusCode >= 200 && result.statusCode < 300) {
            clearCart();
          }
        }}
      />
    </div>
  );
};

