import React, { useEffect, useState } from 'react';
import {
  getWarehouses,
  getProducts,
  postInventoryEvent,
  postInventoryTransfer,
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
];

const titleCls = 'text-xl font-bold leading-tight text-neutral-900';
const descCls = 'mt-2 text-sm leading-relaxed text-neutral-600';
const alertBox = 'rounded-lg border px-3 py-2 text-sm';
const formCard = 'space-y-1 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm';

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

  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState('');
  const [transferErr, setTransferErr] = useState<string | null>(null);
  const [transferOk, setTransferOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [w, p] = await Promise.all([getWarehouses(), getProducts()]);
      if (Array.isArray(w)) {
        setWarehouses(w);
        if (w[0]) {
          setWarehouseId(w[0].id);
          setFromWh(w[0].id);
          setToWh(w[1]?.id ?? w[0].id);
        }
      }
      if (Array.isArray(p)) {
        setProducts(p);
        if (p[0]) {
          setProductId(p[0].id);
          setTransferProductId(p[0].id);
        }
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

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferErr(null);
    setTransferOk(null);
    if (fromWh === toWh) {
      setTransferErr('來源倉與目的倉不可相同');
      return;
    }
    const out = await postInventoryTransfer({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      productId: transferProductId,
      quantity: Math.abs(transferQty),
      note: transferNote.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    if ('statusCode' in out) {
      setTransferErr(getErrorMessage(out as ApiError));
      return;
    }
    setTransferOk(
      `調撥完成 referenceId=${out.referenceId.slice(0, 8)}… 來源倉餘 ${out.balances.from.onHandQty}／目的倉餘 ${out.balances.to.onHandQty}`,
    );
    setTransferNote('');
  };

  const row = 'flex flex-row items-center gap-3 py-1';
  const labelCls =
    'w-36 shrink-0 text-right text-xs font-medium text-neutral-600 sm:text-left';
  const fieldCls =
    'min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900';

  const HeaderLeft = (
    <div className="flex min-h-0 flex-col self-stretch border-b border-transparent pb-4 lg:border-0 lg:pb-0">
      <h2 className={titleCls}>入庫事件</h2>
      <p className={descCls}>
        送出即 POST /inventory/events；扣減類型若會使庫存低於 0 將回傳 INVENTORY_INSUFFICIENT。
      </p>
      <div className="mt-4 flex min-h-[4rem] flex-col gap-2" aria-live="polite">
        {err && (
          <div className={`${alertBox} border-[#E3342F]/25 bg-[#E3342F]/08 text-[#B91C1C]`}>{err}</div>
        )}
        {ok && (
          <div className={`${alertBox} border-[#28A745]/30 bg-[#28A745]/10 text-[#166534]`}>{ok}</div>
        )}
      </div>
    </div>
  );

  const HeaderRight = (
    <div className="flex min-h-0 flex-col self-stretch border-b border-transparent pb-4 lg:border-0 lg:pb-0">
      <h2 className={titleCls}>倉庫調撥</h2>
      <p className={descCls}>
        POST /inventory/transfer：同一筆交易內來源倉扣減、目的倉增加，兩倉需不同。
      </p>
      <div className="mt-4 flex min-h-[4rem] flex-col gap-2" aria-live="polite">
        {transferErr && (
          <div className={`${alertBox} border-[#E3342F]/25 bg-[#E3342F]/08 text-[#B91C1C]`}>
            {transferErr}
          </div>
        )}
        {transferOk && (
          <div className={`${alertBox} border-[#28A745]/30 bg-[#28A745]/10 text-[#166534]`}>{transferOk}</div>
        )}
      </div>
    </div>
  );

  const FormEvent = (
    <form onSubmit={submit} className={formCard}>
      <div className={row}>
        <label className={labelCls}>倉庫</label>
        <select className={fieldCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label className={labelCls}>商品</label>
        <select className={fieldCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label className={labelCls}>事件類型</label>
        <select className={fieldCls} value={type} onChange={(e) => setType(e.target.value as InventoryEventType)}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} ({t.value})
            </option>
          ))}
        </select>
      </div>
      <div className={`${row} items-start`}>
        <label className={`${labelCls} pt-2 leading-snug`}>
          數量
          <span className="mt-0.5 block font-normal text-neutral-500">（正數；出庫類由後端轉負）</span>
        </label>
        <input
          type="number"
          min={1}
          className={fieldCls}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
        />
      </div>
      <div className={row}>
        <label className={labelCls}>備註</label>
        <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="選填" />
      </div>
      <div className="pt-3">
        <Button type="submit" fullWidth>
          送出庫存事件
        </Button>
      </div>
    </form>
  );

  const FormTransfer = (
    <form onSubmit={submitTransfer} className={formCard}>
      <div className={row}>
        <label className={labelCls}>來源倉（出）</label>
        <select className={fieldCls} value={fromWh} onChange={(e) => setFromWh(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label className={labelCls}>目的倉（入）</label>
        <select className={fieldCls} value={toWh} onChange={(e) => setToWh(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label className={labelCls}>商品</label>
        <select
          className={fieldCls}
          value={transferProductId}
          onChange={(e) => setTransferProductId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label className={labelCls}>調撥數量</label>
        <input
          type="number"
          min={1}
          className={fieldCls}
          value={transferQty}
          onChange={(e) => setTransferQty(Number(e.target.value) || 1)}
        />
      </div>
      <div className={row}>
        <label className={labelCls}>備註</label>
        <input
          className={fieldCls}
          value={transferNote}
          onChange={(e) => setTransferNote(e.target.value)}
          placeholder="選填"
        />
      </div>
      <div className="pt-3">
        <Button type="submit" fullWidth>
          送出調撥
        </Button>
      </div>
    </form>
  );

  return (
    <div className="max-w-7xl">
      {/* 窄屏：維持上下堆疊 */}
      <div className="flex flex-col gap-8 lg:hidden">
        <section>
          {HeaderLeft}
          {FormEvent}
        </section>
        <section>
          {HeaderRight}
          {FormTransfer}
        </section>
      </div>
      {/* 寬屏：2×2 grid — 第一列兩標題區同列等高，第二列兩表單頂緣對齊 */}
      <div className="hidden gap-x-6 gap-y-0 lg:grid lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col">{HeaderLeft}</div>
        <div className="flex flex-col">{HeaderRight}</div>
        <div className="min-w-0">{FormEvent}</div>
        <div className="min-w-0">{FormTransfer}</div>
      </div>
    </div>
  );
};
