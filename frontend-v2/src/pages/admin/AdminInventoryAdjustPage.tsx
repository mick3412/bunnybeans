import React, { useEffect, useState } from 'react';
import { listWarehouses } from '../../api/warehouses';
import { listProducts } from '../../api/products';
import { postInventoryEvent, type InventoryEventType, type RecordInventoryEventInput } from '../../api/inventory';
import { Button } from '../../components/Button';

const EVENT_TYPES: { value: InventoryEventType; label: string }[] = [
  { value: 'PURCHASE_IN', label: '採購入庫' },
  { value: 'STOCKTAKE_GAIN', label: '盤盈' },
  { value: 'STOCKTAKE_LOSS', label: '盤虧' },
  { value: 'RETURN_FROM_CUSTOMER', label: '客戶退貨' },
  { value: 'RETURN_TO_SUPPLIER', label: '退供應商' },
  { value: 'TRANSFER_IN', label: '調撥入' },
  { value: 'TRANSFER_OUT', label: '調撥出' },
  { value: 'SALE_OUT', label: '銷售出庫' },
];

export const AdminInventoryAdjustPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<InventoryEventType>('PURCHASE_IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    listWarehouses().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setWarehouses(res);
      if (res.length && !warehouseId) setWarehouseId(res[0].id);
    });
    listProducts().then((res) => {
      if ('statusCode' in res) return;
      setProducts(res);
      if (res.length && !productId) setProductId(res[0].id);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = Number(quantity);
    if (!warehouseId || !productId || Number.isNaN(q) || q <= 0) {
      setErr('請選擇倉庫、商品並輸入有效數量');
      return;
    }
    setErr(null);
    setSuccess(null);
    setSubmitting(true);
    const body: RecordInventoryEventInput = {
      productId,
      warehouseId,
      type,
      quantity: q,
      note: note.trim() || undefined,
    };
    postInventoryEvent(body).then((res) => {
      setSubmitting(false);
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setSuccess('已記錄一筆庫存異動');
      setQuantity('');
      setNote('');
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {err && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{err}</p>}
          {success && <p className="text-sm" style={{ color: 'var(--color-success)' }}>{success}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>倉庫</label>
            <select
              className="input-base w-full"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">請選擇</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>商品</label>
            <select
              className="input-base w-full"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">請選擇</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>異動類型</label>
            <select
              className="input-base w-full"
              value={type}
              onChange={(e) => setType(e.target.value as InventoryEventType)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>數量</label>
            <input
              type="number"
              min={1}
              className="input-base w-full"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>備註（選填）</label>
            <input
              type="text"
              className="input-base w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>{submitting ? '送出中…' : '送出'}</Button>
        </form>
      </div>
    </div>
  );
};
