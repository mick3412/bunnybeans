import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { usePosCart, POS_TAX_RATE } from '../modules/pos/usePosCart';
import type { PosProduct, PosProductDisplay } from '../modules/pos/types';
import { PosCheckoutModal } from './PosCheckoutModal';
import type { CreateOrderResult, CategoryDto, BrandDto } from '../modules/pos/posOrdersApi';
import {
  getProducts,
  getPosProducts,
  getCategories,
  getBrands,
  searchProductsByBarcode,
  productDtoSalePriceNumber,
  previewPromotions,
  type PromotionPreviewResult,
} from '../modules/pos/posOrdersApi';
import { searchCustomers, type CustomerSearchItem } from '../modules/admin/loyaltyApi';
import { listProductTagsForPosDiscount } from '../modules/admin/adminApi';
import { usePosStoreSession } from '../modules/pos/PosStoreSessionContext';
import { PosRetrieveHeldModal } from './pos/PosRetrieveHeldModal';
import { holdCart } from '../modules/pos/posHeldCartsApi';
import { useDebouncedValue } from '../shared/hooks/useDebouncedValue';
import { formatMoney } from '../shared/utils/formatMoney';
import { getErrorMessage } from '../shared/errors/errorMessages';

const ALL_ID = '';
const POS_FAVORITES_KEY = 'pos-favorites';
const POS_HIDE_OUT_OF_STOCK_KEY = 'pos-hide-out-of-stock';

function loadFavorites(): string[] {
  try {
    const s = localStorage.getItem(POS_FAVORITES_KEY);
    if (s) {
      const arr = JSON.parse(s) as unknown;
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(POS_FAVORITES_KEY, JSON.stringify(ids));
}

function loadHideOutOfStock(): boolean {
  try {
    const s = localStorage.getItem(POS_HIDE_OUT_OF_STOCK_KEY);
    return s === '1' || s === 'true';
  } catch {
    return false;
  }
}

function saveHideOutOfStock(hide: boolean) {
  localStorage.setItem(POS_HIDE_OUT_OF_STOCK_KEY, hide ? '1' : '0');
}

const mockProducts: PosProductDisplay[] = Array.from({ length: 16 }).map((_, index) => {
  const categoryIds = ['cat-1', 'cat-2', 'cat-3'];
  const categoryId = categoryIds[index % categoryIds.length];
  const brandId = `brand-${(index % 3) + 1}`;
  const tags: string[] = [];
  if (index % 3 === 0) tags.push('熱銷');
  if (index % 4 === 0) tags.push('新品');
  if (index % 5 === 0) tags.push('清倉');
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
  const { items, summary, addProduct, changeQuantity, clearCart, replaceCart } = usePosCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<CreateOrderResult | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedDiscountTag, setSelectedDiscountTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryDebounced = useDebouncedValue(searchQuery, 300);
  const [gridCols, setGridCols] = useState<3 | 4 | 5>(5);
  const [hideOutOfStock, setHideOutOfStock] = useState(loadHideOutOfStock);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const { apiStoreId, apiMerchantId } = usePosStoreSession();
  const [apiProducts, setApiProducts] = useState<PosProductDisplay[] | null>(null);
  const [apiProductsLoadError, setApiProductsLoadError] = useState<string | null>(null);
  const [previewMemberSearchResults, setPreviewMemberSearchResults] = useState<CustomerSearchItem[]>([]);
  const [previewMemberSearchLoading, setPreviewMemberSearchLoading] = useState(false);
  const [previewSelectedCustomer, setPreviewSelectedCustomer] = useState<CustomerSearchItem | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [favoriteEditMode, setFavoriteEditMode] = useState(false);
  const [favoriteDraftIds, setFavoriteDraftIds] = useState<string[]>([]);
  const [barcodeHint, setBarcodeHint] = useState<string | null>(null);
  const [barcodeChoices, setBarcodeChoices] = useState<PosProduct[]>([]);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [stockOverflowHint, setStockOverflowHint] = useState<string | null>(null);
  const [discountTagOptions, setDiscountTagOptions] = useState<{ tag: string; name: string }[]>([{ tag: '', name: '無' }]);
  const [retrieveModalOpen, setRetrieveModalOpen] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  const handleBarcodeScan = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setBarcodeHint(null);
    setBarcodeChoices([]);
    setBarcodeLoading(true);
    const out = await searchProductsByBarcode(q, 20);
    setBarcodeLoading(false);
    if ('statusCode' in out) {
      setBarcodeHint(out.message ?? '條碼查詢失敗');
      return;
    }
    const mapped: PosProduct[] = out.items.map((p) => ({
      id: p.id,
      name: p.name,
      price: productDtoSalePriceNumber(p),
      sku: p.sku,
    }));
    if (mapped.length === 0) {
      setBarcodeHint('找不到此條碼對應的商品');
      return;
    }
    if (mapped.length === 1) {
      addProduct(mapped[0]);
      setSearchQuery('');
      setBarcodeHint('已加入購物車');
      return;
    }
    setBarcodeHint(`此條碼命中 ${mapped.length} 筆商品`);
    setBarcodeChoices(mapped);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [categoriesRes, brandsRes] = await Promise.all([
        getCategories(),
        getBrands(),
      ]);
      if (!mounted) return;
      if (Array.isArray(categoriesRes) && categoriesRes.length > 0) setCategories(categoriesRes);
      if (Array.isArray(brandsRes) && brandsRes.length > 0) setBrands(brandsRes);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setHoldError(null);
  }, [apiStoreId]);

  useEffect(() => {
    const storeId = apiStoreId ?? '';
    let mounted = true;
    (async () => {
      setApiProductsLoadError(null);
      const productsRes = storeId
        ? await getPosProducts(storeId)
        : await getProducts();
      if (!mounted) return;
      if (Array.isArray(productsRes)) {
        setApiProducts(
          productsRes.map((p) => ({
            id: p.id,
            name: p.name,
            price: productDtoSalePriceNumber(p),
            sku: p.sku,
            onHandQty: 'onHandQty' in p ? (p as { onHandQty?: number }).onHandQty : undefined,
            categoryId: p.categoryId,
            brandId: p.brandId,
            brandName: 'brandName' in p ? (p as { brandName?: string | null }).brandName : undefined,
            tags: p.tags ?? [],
            specSize: p.specSize ?? null,
            specCapacity: p.specCapacity ?? null,
            specStyle: p.specStyle ?? null,
          })),
        );
        setApiProductsLoadError(null);
      } else {
        setApiProductsLoadError(productsRes.message ?? '無法載入商品');
        setApiProducts(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiStoreId]);

  useEffect(() => {
    const mid = apiMerchantId ?? '';
    if (!mid) {
      setDiscountTagOptions([{ tag: '', name: '無' }]);
      return;
    }
    let mounted = true;
    (async () => {
      const out = await listProductTagsForPosDiscount(mid);
      if (!mounted) return;
      if (Array.isArray(out)) {
        setDiscountTagOptions([{ tag: '', name: '無' }, ...out.map((t) => ({ tag: t.name, name: t.name }))]);
      } else {
        setDiscountTagOptions([{ tag: '', name: '無' }]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiMerchantId]);

  const storeId = apiStoreId ?? '';
  const [promoPreview, setPromoPreview] = useState<PromotionPreviewResult | null>(null);

  const handleHold = useCallback(async () => {
    if (!storeId || items.length === 0) return;
    setHoldError(null);
    const out = await holdCart(storeId, items);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setHoldError(getErrorMessage(out));
      return;
    }
    clearCart();
  }, [storeId, items, clearCart]);

  const handleRetrieveSelect = useCallback(
    (retrievedItems: { productId: string; name: string; unitPrice: number; quantity: number }[]) => {
      replaceCart(retrievedItems);
      setRetrieveModalOpen(false);
    },
    [replaceCart],
  );

  const handleAddProduct = useCallback(
    (product: PosProductDisplay) => {
      const qty = typeof product.onHandQty === 'number' ? product.onHandQty : null;
      const cartQty = items.filter((i) => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
      const wouldExceed = qty !== null && cartQty + 1 > qty;
      if (wouldExceed) {
        setStockOverflowHint(`${product.name} 庫存不足，最多可購買 ${qty} 件`);
        setTimeout(() => setStockOverflowHint(null), 4000);
        return;
      }
      addProduct(product as PosProduct);
    },
    [items, addProduct],
  );
  /** 與結帳 Modal 相同：UUID → 促銷試算帶 customerId */
  const [previewMemberRaw, setPreviewMemberRaw] = useState('');
  const productsForGrid = apiProducts ?? mockProducts;
  const stockByProductId = useMemo(() => {
    const m: Record<string, number | null> = {};
    productsForGrid.forEach((p) => {
      m[p.id] = typeof p.onHandQty === 'number' ? p.onHandQty : null;
    });
    return m;
  }, [productsForGrid]);

  const previewCustomerId = useMemo(() => {
    const s = previewMemberRaw.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ) {
      return s;
    }
    return null;
  }, [previewMemberRaw]);

  const searchPreviewMembers = useCallback(async (q: string) => {
    const merchantId = apiMerchantId ?? '';
    if (!merchantId || !q.trim()) {
      setPreviewMemberSearchResults([]);
      return;
    }
    setPreviewMemberSearchLoading(true);
    const out = await searchCustomers(merchantId, q.trim());
    setPreviewMemberSearchLoading(false);
    if ('statusCode' in out) {
      setPreviewMemberSearchResults([]);
      return;
    }
    setPreviewMemberSearchResults(out.items ?? []);
  }, [apiMerchantId]);

  useEffect(() => {
    const merchantId = apiMerchantId ?? '';
    if (!merchantId || !previewMemberRaw.trim()) {
      setPreviewMemberSearchResults([]);
      return;
    }
    if (previewSelectedCustomer && previewMemberRaw === previewSelectedCustomer.id) {
      setPreviewMemberSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPreviewMembers(previewMemberRaw);
    }, 300);
    return () => clearTimeout(t);
  }, [apiMerchantId, previewMemberRaw, previewSelectedCustomer, searchPreviewMembers]);

  useEffect(() => {
    if (!storeId || !items.length) {
      setPromoPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const payload = {
        storeId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        ...(previewCustomerId ? { customerId: previewCustomerId } : {}),
      };
      const res = await previewPromotions(payload);
      if (cancelled) return;
      if ('statusCode' in res) setPromoPreview(null);
      else setPromoPreview(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, items, previewCustomerId]);
  const brandList: { id: string; name: string }[] = [{ id: ALL_ID, name: '全部' }, ...brands.map((b) => ({ id: b.id, name: b.name }))];

  const filteredProducts = useMemo(() => {
    let list = productsForGrid;
    if (selectedCategoryIds.length > 0) {
      list = list.filter((p) => p.categoryId && selectedCategoryIds.includes(p.categoryId));
    }
    if (selectedBrandIds.length > 0) {
      list = list.filter((p) => p.brandId && selectedBrandIds.includes(p.brandId));
    }
    if (selectedDiscountTag) {
      list = list.filter((p) => p.tags?.includes(selectedDiscountTag));
    }
    if (searchQueryDebounced.trim()) {
      const q = searchQueryDebounced.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)),
      );
    }
    if (hideOutOfStock) {
      list = list.filter((p) => (typeof p.onHandQty !== 'number' ? true : p.onHandQty > 0));
    }
    /* 排序：品牌(brandName) → SKU */
    list = [...list].sort((a, b) => {
      const brandA = (a.brandName ?? a.brandId ?? '').toLowerCase();
      const brandB = (b.brandName ?? b.brandId ?? '').toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      return (a.sku ?? '').localeCompare(b.sku ?? '');
    });
    return list;
  }, [productsForGrid, selectedCategoryIds, selectedBrandIds, selectedDiscountTag, searchQueryDebounced, hideOutOfStock]);

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
  const activeFavoriteIds = favoriteEditMode ? favoriteDraftIds : favoriteIds;

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex min-h-0 flex-1 flex-col gap-3 pb-[calc(14rem+env(safe-area-inset-bottom))] lg:flex-row lg:pb-4">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-white p-2 shadow-sm shadow-black/5 sm:p-3 lg:min-w-0 lg:flex-[3]">
          <div className="mb-2 grid grid-cols-1 gap-1.5 min-[640px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-[640px]:grid-rows-[auto_auto]">
            <div className="rounded-xl bg-table-head px-2.5 py-1.5 min-[640px]:row-span-2">
              <div className="mb-0.5 text-xs font-semibold text-muted">篩選</div>
              <div className="mb-1 flex flex-wrap items-center gap-0.5">
                <span className="mr-0.5 text-xs font-medium text-muted">品項</span>
                {[{ id: ALL_ID, name: '全部' }, ...categories].map((c) => {
                  const selected =
                    c.id === ALL_ID ? selectedCategoryIds.length === 0 : selectedCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryIds(c.id === ALL_ID ? [] : [c.id]);
                      }}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-table-head text-content hover:bg-brand-surface'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <div className="mb-1 flex flex-wrap items-center gap-0.5">
                <span className="mr-0.5 text-xs font-medium text-muted">品牌</span>
                {brandList.map((b) => {
                  const id = b.id;
                  const selected =
                    id === ALL_ID ? selectedBrandIds.length === 0 : selectedBrandIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedBrandIds(id === ALL_ID ? [] : [id]);
                      }}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-table-head text-content hover:bg-brand-surface'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
              <div className="mb-1 flex flex-wrap items-center gap-0.5">
                <span className="mr-0.5 text-xs font-medium text-muted">折扣</span>
                {discountTagOptions.map((d) => {
                  const selected = selectedDiscountTag === d.tag;
                  return (
                    <button
                      key={d.tag || 'none'}
                      type="button"
                      data-testid={d.tag ? `pos-filter-tag-${d.tag}` : 'pos-filter-tag-none'}
                      onClick={() => {
                        setSelectedDiscountTag(d.tag);
                      }}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-table-head text-content hover:bg-brand-surface'
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
                <span className="mx-1 text-xs text-muted">·</span>
                <span className="mr-0.5 text-xs font-medium text-muted">無庫存</span>
                {(['show', 'hide'] as const).map((opt) => {
                  const selected = (opt === 'hide') === hideOutOfStock;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const next = opt === 'hide';
                        setHideOutOfStock(next);
                        saveHideOutOfStock(next);
                      }}
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-table-head text-content hover:bg-brand-surface'
                      }`}
                      data-testid={`e2e-pos-out-of-stock-${opt}`}
                    >
                      {opt === 'show' ? '顯示' : '不顯示'}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted">
                <span>共 {filteredProducts.length} 件</span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-medium underline hover:text-content"
                  >
                    清除篩選
                  </button>
                )}
              </div>
            </div>

            {/* 搜尋、欄數：各一塊卡片，上下排列 */}
            <div className="flex min-w-0 flex-col gap-2 min-[640px]:contents">
              <div className="flex items-center rounded-2xl bg-table-head px-3 py-2 min-[640px]:col-start-2 min-[640px]:row-start-1">
                <div className="relative w-full min-w-0">
                  <input
                    type="search"
                    placeholder="搜尋商品或掃條碼（Enter 加入）"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (barcodeHint) setBarcodeHint(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleBarcodeScan();
                      }
                    }}
                    className="w-full rounded-full border border-brand-surface bg-white px-3 py-1.5 pr-8 text-xs text-content placeholder:text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    data-testid="e2e-pos-barcode-input"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
                    ⌘K
                  </span>
                </div>
              </div>
              {barcodeHint && (
                <div className="mt-1 text-xs text-brand-warning" data-testid="e2e-pos-barcode-hint">
                  {barcodeHint}
                </div>
              )}
              {barcodeLoading ? (
                <div className="mt-1 text-xs text-muted">條碼查詢中…</div>
              ) : null}
              {!barcodeLoading && barcodeChoices.length > 1 ? (
                <div className="mt-2 rounded-xl border border-brand-surface bg-white p-2" data-testid="e2e-pos-barcode-choices">
                  <div className="mb-1 text-xs font-semibold text-muted">選擇商品</div>
                  <div className="flex flex-col gap-1">
                    {barcodeChoices.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex items-center justify-between gap-2 rounded-lg border border-brand-surface px-2 py-1.5 text-left text-xs hover:bg-brand-canvas"
                        onClick={() => {
                          addProduct(p);
                          setBarcodeChoices([]);
                          setSearchQuery('');
                          setBarcodeHint('已加入購物車');
                        }}
                      >
                        <span className="min-w-0 truncate text-content">
                          {p.name}
                          {(p as { sku?: string }).sku ? (
                            <span className="ml-2 font-mono text-[11px] text-muted">{(p as { sku?: string }).sku}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {formatMoney(p.price)}
                        </span>
                      </button>
                    ))}
                    {barcodeChoices.length > 8 ? (
                      <div className="text-[11px] text-muted">…尚有 {barcodeChoices.length - 8} 筆，請縮小條碼或調整資料</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-table-head px-2.5 py-1.5 text-xs min-[640px]:col-start-2 min-[640px]:row-start-2">
                <span className="mr-0.5 shrink-0 text-muted">欄數</span>
                {([3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGridCols(n)}
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      gridCols === n ? 'bg-brand-primary text-white' : 'bg-table-head text-muted hover:bg-brand-surface'
                    }`}
                    aria-label={`${n} 欄`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {apiProductsLoadError && (
            <div className="mb-2 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-2 py-1.5 text-xs text-brand-warning">
              {apiProductsLoadError}，結帳將使用 mock 資料。
            </div>
          )}
          {stockOverflowHint && (
            <div className="mb-2 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-2 py-1.5 text-xs text-brand-warning">
              {stockOverflowHint}
            </div>
          )}
          {activeFavoriteIds.length > 0 && (
            <div className="mb-2 rounded-xl border border-brand-surface bg-white p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-xs font-semibold text-muted">常用</div>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/5"
                  onClick={() => {
                    if (favoriteEditMode) {
                      setFavoriteIds(favoriteDraftIds);
                      saveFavorites(favoriteDraftIds);
                      setFavoriteEditMode(false);
                    } else {
                      setFavoriteDraftIds(favoriteIds);
                      setFavoriteEditMode(true);
                    }
                  }}
                >
                  {favoriteEditMode ? '完成' : '編輯'}
                </button>
              </div>
              <div className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5">
                {productsForGrid
                  .filter((p) => activeFavoriteIds.includes(p.id))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="relative inline-flex items-center gap-1 rounded-lg border border-brand-surface bg-table-head px-2 py-1.5 text-left text-xs hover:border-brand-primary/50 hover:bg-brand-primary/5"
                    >
                      <button
                        type="button"
                        data-testid={`pos-favorite-${p.id}`}
                        onClick={() => handleAddProduct(p)}
                        className="flex-1 text-left"
                      >
                        <span className="font-medium text-content">{p.name}</span>
                        <span className="ml-1 text-brand-primary">${p.price}</span>
                      </button>
                      {favoriteEditMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavoriteDraftIds((prev) => prev.filter((id) => id !== p.id));
                          }}
                          className="shrink-0 rounded px-1 py-0.5 text-brand-danger hover:bg-brand-danger/10"
                          title="移除常用"
                          aria-label="移除常用"
                        >
                          －
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* content-start + 固定卡高：與 3 欄時相同高度，不因欄數或少筆商品而撐滿整區 */}
          <div
            className={`grid min-h-[min(50vh,380px)] flex-1 content-start gap-2 overflow-y-auto rounded-xl border border-dashed border-brand-surface bg-table-head p-2 auto-rows-auto ${gridClass}`}
          >
            {filteredProducts.map((product) => {
              const isFav = activeFavoriteIds.includes(product.id);
              const qty = typeof product.onHandQty === 'number' ? product.onHandQty : null;
              const isLowStock = qty !== null && qty <= 3 && qty >= 0;
              const isOutOfStock = qty !== null && qty <= 0;
              return (
                <div
                  key={product.id}
                  className={`relative flex h-[118px] w-full min-w-0 shrink-0 flex-col justify-between rounded-lg px-2 py-1.5 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 sm:h-[120px] ${
                    isOutOfStock
                      ? 'bg-brand-surface hover:bg-slate-200'
                      : 'bg-white hover:bg-brand-primary/5'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`pos-product-${product.id}`}
                    data-product-name={product.name}
                    onClick={() => handleAddProduct(product)}
                    className="absolute inset-0 z-0 rounded-lg text-left"
                  />
                  <div className="relative z-10 flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1 text-left">
                      <span className="line-clamp-2 font-medium leading-snug text-content">{product.name}</span>
                      {(() => {
                        const specs = [product.specStyle, product.specSize, product.specCapacity]
                          .map((x) => (x ?? '').trim())
                          .filter(Boolean)
                          .join(' / ');
                        return specs ? (
                          <span className="mt-0.5 line-clamp-1 block w-full truncate text-[11px] text-muted" title={specs}>
                            {specs}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {favoriteEditMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFavoriteDraftIds((prev) =>
                            prev.includes(product.id) ? prev.filter((id) => id !== product.id) : [...prev, product.id],
                          );
                        }}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                          isFav ? 'text-brand-danger hover:bg-brand-danger/10' : 'text-brand-success hover:bg-brand-success/10'
                        }`}
                        title={isFav ? '移除常用' : '加入常用'}
                        aria-label={isFav ? '移除常用' : '加入常用'}
                      >
                        {isFav ? '－' : '＋'}
                      </button>
                    ) : null}
                  </div>
                  <div className="pointer-events-none relative z-10 flex items-center justify-between gap-1">
                    {qty !== null ? (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                          isOutOfStock
                            ? 'bg-brand-surface text-brand-danger'
                            : isLowStock
                              ? 'bg-table-head text-brand-danger'
                              : 'bg-table-head text-muted'
                        }`}
                        title="庫存"
                      >
                        {qty}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-brand-primary">
                      {formatMoney(product.price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="fixed bottom-0 left-0 right-0 z-20 max-h-[42vh] w-full border-t border-brand-surface bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:static lg:z-0 lg:max-h-none lg:w-[340px] lg:shrink-0 lg:self-stretch lg:border-t-0 lg:shadow-sm lg:rounded-2xl lg:pb-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-content">購物車</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setRetrieveModalOpen(true)}
                disabled={!storeId}
                data-testid="e2e-pos-retrieve-btn"
              >
                取單
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleHold}
                disabled={!storeId || items.length === 0}
                data-testid="e2e-pos-hold-btn"
              >
                掛單
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={clearCart}>
                清空
              </Button>
            </div>
          </div>
          {holdError && (
            <div className="mb-2 text-xs text-brand-danger">{holdError}</div>
          )}
          <div className="flex min-h-[7rem] flex-1 flex-col space-y-2 overflow-y-auto text-xs">
            {items.length === 0 ? (
              <div className="flex min-h-[7rem] items-center justify-center py-4 text-center text-muted" data-testid="e2e-pos-cart-empty">
                尚無品項
              </div>
            ) : (
              items.map((line) => (
                (() => {
                  const stock = stockByProductId[line.productId];
                  const stockLimited = typeof stock === 'number' && stock >= 0;
                  const outOfStockForCart = stockLimited && stock <= 0;
                  const reachStockLimit = stockLimited && line.quantity >= stock;
                  return (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-brand-surface bg-table-head px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-content">{line.name}</div>
                    <div className="text-xs text-muted">
                      ${line.unitPrice} × {line.quantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-brand-surface bg-white px-1.5 py-0.5 text-xs"
                      onClick={() => changeQuantity(line.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      className={`rounded border px-1.5 py-0.5 text-xs ${
                        reachStockLimit || outOfStockForCart
                          ? 'cursor-not-allowed border-brand-surface bg-table-head text-muted'
                          : 'border-brand-surface bg-white'
                      }`}
                      onClick={() => {
                        if (reachStockLimit || outOfStockForCart) {
                          const max = Math.max(stock ?? 0, 0);
                          setStockOverflowHint(`${line.name} 庫存不足，最多可購買 ${max} 件`);
                          setTimeout(() => setStockOverflowHint(null), 2500);
                          return;
                        }
                        changeQuantity(line.id, line.quantity + 1);
                      }}
                      title={reachStockLimit || outOfStockForCart ? `庫存不足，最多 ${Math.max(stock ?? 0, 0)} 件` : undefined}
                    >
                      +
                    </button>
                  </div>
                </div>
                  );
                })()
              ))
            )}
          </div>
          {apiMerchantId && (
            <div className="mt-2 border-t border-brand-surface pt-2">
              <label className="mb-1 block text-xs font-medium text-muted">
                促銷試算用會員（可選）
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="手機、會員代碼或姓名（選填）"
                  data-testid="e2e-pos-preview-customer"
                  value={previewSelectedCustomer ? `${previewSelectedCustomer.name}${previewSelectedCustomer.phone ? ` · ${previewSelectedCustomer.phone}` : ''}` : previewMemberRaw}
                  onChange={(e) => {
                    setPreviewMemberRaw(e.target.value);
                    setPreviewSelectedCustomer(null);
                  }}
                  className="w-full rounded-lg border border-brand-surface bg-white px-2 py-1.5 text-xs text-content placeholder:text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
                {previewMemberSearchLoading && (
                  <p className="absolute left-0 top-full mt-0.5 text-[10px] text-muted">搜尋中…</p>
                )}
                {previewMemberSearchResults.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded border border-brand-surface bg-white shadow-lg">
                    <li>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-xs text-muted hover:bg-table-head"
                        onClick={() => {
                          setPreviewMemberRaw('');
                          setPreviewSelectedCustomer(null);
                          setPreviewMemberSearchResults([]);
                        }}
                      >
                        不指定
                      </button>
                    </li>
                    {previewMemberSearchResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-2 py-1.5 text-left text-xs hover:bg-table-head"
                          onClick={() => {
                            setPreviewMemberRaw(c.id);
                            setPreviewSelectedCustomer(c);
                            setPreviewMemberSearchResults([]);
                          }}
                        >
                          {c.name}
                          {c.phone ? ` · ${c.phone}` : ''}
                          {c.memberCode ? ` (${c.memberCode})` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {previewSelectedCustomer?.memberLevel && (
                <div className="mt-1 text-xs font-semibold text-brand-warning">
                  等級：{previewSelectedCustomer.memberLevel}
                </div>
              )}
            </div>
          )}
          <div className="mt-2 space-y-1 border-t border-brand-surface pt-2 text-xs text-muted">
            <div className={`flex justify-between ${summary.totalQuantity > 0 ? 'text-muted' : 'text-muted/70'}`}>
              <span>共 {summary.totalQuantity} 件</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>小計</span>
              <span className="tabular-nums">
                {formatMoney(promoPreview?.subtotal ?? summary.subtotal)}
              </span>
            </div>
            {items.length > 0 && (
              <div
                className={`flex justify-between ${
                  promoPreview && promoPreview.discount > 0 ? 'text-brand-success' : 'text-muted'
                }`}
              >
                <span>促銷折讓</span>
                <span className="tabular-nums">
                  {promoPreview && promoPreview.discount > 0
                    ? `-${formatMoney(promoPreview.discount)}`
                    : '—'}
                </span>
              </div>
            )}
            {POS_TAX_RATE > 0 && (
              <div className="flex justify-between">
                <span>稅額 ({Math.round(POS_TAX_RATE * 100)}%)</span>
                <span className="tabular-nums">{formatMoney(summary.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-content">
              <span>應收</span>
              <span className="tabular-nums">
                {formatMoney(promoPreview?.total ?? summary.total)}
              </span>
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
            <div className="mt-2 rounded-lg bg-brand-success/10 px-2 py-1.5 text-xs text-brand-success">
              最新訂單{' '}
              <Link
                to={`/pos/orders/${lastOrderResult.body.id}`}
                className="font-semibold underline underline-offset-2 hover:text-brand-primary"
              >
                {lastOrderResult.body.orderNumber}
              </Link>
              {lastOrderResult.body.credit ? '（掛帳）' : ''}
            </div>
          )}
        </section>
      </main>

      <PosCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={items}
        totalAmount={promoPreview?.total ?? summary.total}
        storeId={storeId}
        merchantId={apiMerchantId ?? ''}
        onOrderCreated={(result) => {
          setLastOrderResult(result);
          if (result.statusCode >= 200 && result.statusCode < 300) {
            clearCart();
            setPromoPreview(null);
            setPreviewMemberRaw('');
            setPreviewSelectedCustomer(null);
            setPreviewMemberSearchResults([]);
          }
        }}
        initialMemberInput={previewMemberRaw}
      />
      <PosRetrieveHeldModal
        open={retrieveModalOpen}
        storeId={storeId}
        onClose={() => setRetrieveModalOpen(false)}
        onSelect={handleRetrieveSelect}
      />
    </div>
  );
};
