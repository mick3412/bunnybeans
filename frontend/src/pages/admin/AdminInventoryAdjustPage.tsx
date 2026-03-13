import React, { useEffect, useState } from 'react';
import {
  getWarehouses,
  getProducts,
  postInventoryEvent,
  type WarehouseDto,
  type ProductFullDto,
  type InventoryEventType,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';

const EVENT_TYPES: { value: InventoryEventType; label: string }[] = [
  { value: 'PURCHASE_IN', label: '進貨入庫' },
  { value: 'STOCKTAKE_GAIN', label: '盤點盤盈' },
  { value: 'STOCKTAKE_LOSS', label: '盤點盤虧' },
  { value: 'RETURN_FROM_CUSTOMER', label: '客戶退貨入庫' },
  { value: 'TRANSFER_IN', label: '調撥入' },
  { value: 'TRANSFER_OUT', label: '調撥出' },
];

export const AdminInventoryAdjustPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [products, setProducts] = useState<ProductFullDto[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<InventoryEventType>('PURCHASE_IN');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [w, p] = await Promise.all([getWarehouses(), getProducts()]);
      if (Array.isArray(w)) {
        setWarehouses(w);
        if (w[0]) setWarehouseId(w[0].id);
      }
      if (Array.isArray(p)) {
        setProducts(p);
        if (p[0]) setProductId(p[0].id);
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const out = await postInventoryEvent({
      productId,
      warehouseId,
      type,
      quantity: Math.abs(quantity),
      note: note.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    if ('statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    setOk(`已寫入事件，庫存結餘：${out.balance.onHandQty}`);
    setNote('');
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-xl font-bold text-slate-900">入庫／盤點</h1>
      <p className="mb-4 text-sm text-slate-500">
        送出即 POST /inventory/events；扣減類型若會使庫存低於 0 將回傳 INVENTORY_INSUFFICIENT。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">倉庫</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">商品</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">事件類型</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as InventoryEventType)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({t.value})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">數量（正數；出庫類由後端轉負）</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">備註</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="選填"
          />
        </div>
        <Button type="submit" fullWidth>
          送出庫存事件
        </Button>
      </form>
    </div>
  );
};
