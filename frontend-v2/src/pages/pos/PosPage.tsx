import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStores } from '../../api/posOrders';
import { listProducts, type ProductDto } from '../../api/products';
import { createOrder } from '../../api/posOrders';
import { Button } from '../../components/Button';

export type CartItem = { productId: string; name: string; quantity: number; unitPrice: number };

function unitPriceFromProduct(p: ProductDto): number {
  if (p.salePrice != null && p.salePrice !== '') {
    const n = Number(p.salePrice);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export const PosPage: React.FC = () => {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    getStores().then((res) => {
      if ('statusCode' in res) return;
      setStores(res);
      if (res.length && !selectedStoreId) setSelectedStoreId(res[0].id);
    });
    listProducts().then((res) => {
      if ('statusCode' in res) return;
      setProducts(res);
    });
  }, []);

  useEffect(() => {
    if (stores.length && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const addToCart = (p: ProductDto) => {
    const unitPrice = unitPriceFromProduct(p);
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, quantity: 1, unitPrice }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      const q = next[i].quantity + delta;
      if (q <= 0) return next.filter((_, j) => j !== i);
      next[i] = { ...next[i], quantity: q };
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
  };

  const subtotal = cart.reduce((sum, x) => sum + x.quantity * x.unitPrice, 0);

  const handleCheckout = () => {
    if (!selectedStoreId || cart.length === 0) {
      setErr('請選擇門市並加入商品');
      return;
    }
    setErr(null);
    setLastOrderNumber(null);
    setCheckoutLoading(true);
    createOrder({
      storeId: selectedStoreId,
      items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity, unitPrice: x.unitPrice })),
      payments: [{ method: 'CASH', amount: Math.round(subtotal * 100) / 100 }],
    }).then((res) => {
      setCheckoutLoading(false);
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setLastOrderNumber(res.orderNumber);
      setCart([]);
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h3 className="section-title mb-3">會員</h3>
          <p className="mb-3 text-sm" style={{ color: 'var(--color-muted)' }}>
            輸入電話或會員編號綁定本筆訂單
          </p>
          <input
            type="text"
            placeholder="電話或會員編號"
            className="input-base"
            aria-label="會員查詢"
          />
        </div>
        <div className="card p-4 lg:col-span-2">
          <h3 className="section-title mb-3">購物車</h3>
          <div className="min-h-[12rem] rounded border p-4" style={{ borderColor: 'var(--color-border)' }}>
            {cart.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>尚未加入商品</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((x) => (
                  <li key={x.productId} className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: 'var(--color-content)' }}>
                    <span className="min-w-0 flex-1 truncate">{x.name}</span>
                    <span className="tabular-nums">${x.unitPrice} × {x.quantity}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded px-2 py-0.5 text-xs hover:bg-[var(--color-table-head)]"
                        onClick={() => updateQty(x.productId, -1)}
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums">{x.quantity}</span>
                      <button
                        type="button"
                        className="rounded px-2 py-0.5 text-xs hover:bg-[var(--color-table-head)]"
                        onClick={() => updateQty(x.productId, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-1 rounded px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => removeFromCart(x.productId)}
                      >
                        刪除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="section-title mb-3">商品</h3>
          <div className="flex flex-wrap gap-2">
            {products.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>載入中…</p>
            ) : (
              products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-table-head)]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-content)' }}
                  onClick={() => addToCart(p)}
                >
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>${unitPriceFromProduct(p)}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="section-title mb-3">本筆摘要</h3>
          {selectedStoreId && (
            <div className="mb-2">
              <label className="text-xs" style={{ color: 'var(--color-muted)' }}>門市</label>
              <select
                className="input-base mt-1 w-full"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <p className="mb-2 text-sm" style={{ color: 'var(--color-muted)' }}>
            小計：{cart.length ? subtotal.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
          </p>
          {err && <p className="mb-2 text-sm" style={{ color: 'var(--color-danger)' }}>{err}</p>}
          {lastOrderNumber && <p className="mb-2 text-sm" style={{ color: 'var(--color-success)' }}>已結帳：{lastOrderNumber}</p>}
          <Button
            className="w-full"
            disabled={checkoutLoading || cart.length === 0}
            onClick={handleCheckout}
          >
            {checkoutLoading ? '結帳中…' : '結帳'}
          </Button>
          <p className="mt-3 text-sm" style={{ color: 'var(--color-muted)' }}>
            <Link to="/pos/orders" style={{ color: 'var(--color-primary)' }}>訂單列表</Link>、{' '}
            <Link to="/pos/promos" style={{ color: 'var(--color-primary)' }}>促銷</Link>、{' '}
            <Link to="/pos/reports" style={{ color: 'var(--color-primary)' }}>報表</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
