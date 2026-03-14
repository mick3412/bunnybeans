import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  listPurchaseOrders,
  listSuppliers,
  getPurchaseOrder,
  createPurchaseOrder,
  submitPo,
  cancelPo,
  poTotal,
  MOCK_MERCHANT,
  type PurchaseOrderDto,
  type PoStatus,
  type ApiError,
} from '../../modules/admin/purchaseApi';
import { listMerchants, getProducts, getWarehouses } from '../../modules/admin/adminApi';
import { useAdminToast } from './AdminToastContext';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'ORDERED', label: '已下單' },
  { key: 'PARTIALLY_RECEIVED', label: '部分到貨' },
  { key: 'RECEIVED', label: '已收貨' },
  { key: 'CANCELLED', label: '已取消' },
];

function statusLabel(s: PoStatus | string) {
  const m: Record<string, string> = {
    DRAFT: '草稿',
    ORDERED: '已下單',
    PARTIALLY_RECEIVED: '部分到貨',
    RECEIVED: '已收貨',
    CANCELLED: '已取消',
  };
  return m[s] ?? s;
}

function statusPill(s: PoStatus | string) {
  const styles: Record<string, string> = {
    RECEIVED: 'bg-emerald-100 text-emerald-800',
    ORDERED: 'bg-orange-100 text-orange-800',
    PARTIALLY_RECEIVED: 'bg-violet-100 text-violet-900',
    DRAFT: 'bg-neutral-200 text-neutral-700',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return styles[s] ?? 'bg-neutral-100 text-neutral-700';
}

type LineDraft = { productId: string; qty: number; unitCost: number };

export const AdminPurchaseOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useAdminToast();
  const [merchantId, setMerchantId] = useState(MOCK_MERCHANT);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PurchaseOrderDto[]>([]);
  const [detail, setDetail] = useState<PurchaseOrderDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [defaultWh, setDefaultWh] = useState('');
  const [products, setProducts] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [newPo, setNewPo] = useState({
    supplierId: '',
    expectedDate: '',
    remark: '',
    lines: [{ productId: '', qty: 1, unitCost: 0 }] as LineDraft[],
  });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const po = await listPurchaseOrders(merchantId, status, q || undefined);
    const sups = await listSuppliers(merchantId);
    setListLoading(false);
    const err = po.error ?? sups.error;
    if (err) {
      setListError(err.message);
      setRows([]);
      setSuppliers([]);
      showToast(err.message, 'err');
      return;
    }
    setRows(po.data);
    setSuppliers(sups.data.map((s) => ({ id: s.id, name: s.name })));
  }, [merchantId, status, q, showToast]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) setMerchantId((prev) => (prev === MOCK_MERCHANT ? m[0].id : prev));
      const wh = await getWarehouses();
      if (Array.isArray(wh) && wh[0]) setDefaultWh(wh[0].id);
      const pr = await getProducts();
      if (Array.isArray(pr)) setProducts(pr.map((p) => ({ id: p.id, sku: p.sku, name: p.name })));
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 搜尋 debounce：務必呼叫 loadRef，避免 timer 閉包仍為 MOCK_MERCHANT 而把列表洗空 */
  useEffect(() => {
    const t = setTimeout(() => loadRef.current(), 280);
    return () => clearTimeout(t);
  }, [q]);

  const openDetail = async (id: string) => {
    const out = await getPurchaseOrder(id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    setDetail(out);
  };

  const submit = async () => {
    if (!detail) return;
    const out = await submitPo(detail.id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    showToast('已下單', 'ok');
    setDetail(out);
    load();
  };

  const cancel = async () => {
    if (!detail) return;
    if (!confirm('確定取消？')) return;
    const out = await cancelPo(detail.id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    showToast('已取消', 'ok');
    setDetail(out);
    load();
  };

  const createPo = async () => {
    if (!newPo.supplierId || !defaultWh) {
      showToast('請選供應商', 'err');
      return;
    }
    const validLines = newPo.lines.filter((l) => l.productId && l.qty > 0);
    if (!validLines.length) {
      showToast('請至少一列訂購品項', 'err');
      return;
    }
    const orderNumber = `PO-${Date.now().toString().slice(-8)}`;
    const out = await createPurchaseOrder({
      merchantId,
      supplierId: newPo.supplierId,
      warehouseId: defaultWh,
      orderNumber,
      expectedDate: newPo.expectedDate || undefined,
      lines: validLines.map((l) => ({ productId: l.productId, qtyOrdered: l.qty, unitCost: l.unitCost })),
    });
    if ('statusCode' in out) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    showToast('已建立採購單', 'ok');
    setCreateOpen(false);
    setNewPo({ supplierId: '', expectedDate: '', remark: '', lines: [{ productId: '', qty: 1, unitCost: 0 }] });
    load();
    openDetail(out.id);
  };

  const totalDraft = newPo.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  return (
    <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100" data-testid="e2e-admin-purchase-orders">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">採購單管理</h1>
          <p className="mt-1 text-sm text-neutral-500">建立與追蹤採購訂單</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          + 新增採購單
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/80 py-2.5 pl-10 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="搜尋單號 / 供應商..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {listError && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>載入失敗：{listError}</span>
          <button type="button" className="rounded-md bg-red-100 px-3 py-1 font-medium hover:bg-red-200" onClick={() => load()}>
            重試
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-100">
        {listLoading ? (
          <div className="flex min-h-[200px] items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-label="載入中" />
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50/90 text-xs font-semibold uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">單號</th>
                  <th className="px-4 py-3">供應商</th>
                  <th className="px-4 py-3 text-center">品項數</th>
                  <th className="px-4 py-3 text-right">金額</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="cursor-pointer border-b border-neutral-50 hover:bg-neutral-50/80" onClick={() => openDetail(p.id)}>
                    <td className="px-4 py-3.5 font-mono text-xs font-medium">{p.orderNumber}</td>
                    <td className="px-4 py-3.5 text-neutral-800">{p.supplierName ?? '—'}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums">{(p.lines ?? []).length}</td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums">${poTotal({ ...p, lines: p.lines ?? [] }).toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold ${statusPill(p.status)}`}>{statusLabel(p.status)}</span>
                    </td>
                    <td className="px-2 py-3.5 text-neutral-400" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 hover:text-blue-600" onClick={() => openDetail(p.id)} aria-label="詳情">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listError && rows.length === 0 && <div className="py-16 text-center text-neutral-500">尚無採購單</div>}
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">{detail.orderNumber}</h2>
              <button type="button" className="text-neutral-400 hover:text-neutral-700" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>
            <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusPill(detail.status)}`}>{statusLabel(detail.status)}</span>
            <p className="mt-2 text-sm text-neutral-600">供應商：{detail.supplierName ?? '—'}</p>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b bg-neutral-50">
                <tr>
                  <th className="px-2 py-2 text-left">品名</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2 text-right">數量</th>
                  <th className="px-2 py-2 text-right">單價</th>
                  <th className="px-2 py-2 text-right">已收</th>
                  <th className="px-2 py-2 text-right">小計</th>
                </tr>
              </thead>
              <tbody>
                {(detail.lines ?? []).map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-2 py-2">{l.name ?? '—'}</td>
                    <td className="px-2 py-2 font-mono text-xs">{l.sku ?? '—'}</td>
                    <td className="px-2 py-2 text-right">{l.qtyOrdered}</td>
                    <td className="px-2 py-2 text-right">{l.unitCost}</td>
                    <td className="px-2 py-2 text-right">{l.qtyReceived}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.qtyOrdered * l.unitCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right font-semibold">總金額 ${poTotal(detail).toLocaleString()}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.status === 'DRAFT' && (
                <>
                  <Button variant="primary" onClick={submit}>
                    送出／下單
                  </Button>
                  <Button variant="ghost" onClick={cancel}>
                    取消採購單
                  </Button>
                </>
              )}
              {(detail.status === 'ORDERED' || detail.status === 'PARTIALLY_RECEIVED') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDetail(null);
                    navigate(`/admin/receiving-notes?newPo=${detail.id}`);
                  }}
                >
                  建立驗收單
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">新增採購單</h2>
                <p className="mt-1 text-sm text-neutral-500">建立新的採購訂單</p>
              </div>
              <button type="button" className="text-neutral-400 hover:text-neutral-700" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  供應商 <span className="text-red-500">*</span>
                </label>
                <select className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={newPo.supplierId} onChange={(e) => setNewPo({ ...newPo, supplierId: e.target.value })}>
                  <option value="">選擇供應商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">預計到貨日</label>
                <input type="date" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={newPo.expectedDate} onChange={(e) => setNewPo({ ...newPo, expectedDate: e.target.value })} />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-neutral-800">訂購品項</h3>
              <table className="mt-2 w-full text-sm">
                <thead className="border-b text-left text-xs text-neutral-500">
                  <tr>
                    <th className="py-2 pr-2">商品</th>
                    <th className="w-24 py-2">數量</th>
                    <th className="w-28 py-2">單價</th>
                    <th className="w-24 py-2 text-right">小計</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {newPo.lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-neutral-100">
                      <td className="py-2 pr-2">
                        <select className="w-full rounded border px-2 py-1.5 text-sm" value={line.productId} onChange={(e) => {
                          const lines = [...newPo.lines];
                          lines[idx] = { ...lines[idx], productId: e.target.value };
                          setNewPo({ ...newPo, lines });
                        }}>
                          <option value="">選擇商品</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="number" min={1} className="w-full rounded border px-2 py-1.5 text-right tabular-nums" value={line.qty} onChange={(e) => {
                          const lines = [...newPo.lines];
                          lines[idx] = { ...lines[idx], qty: Number(e.target.value) || 0 };
                          setNewPo({ ...newPo, lines });
                        }} />
                      </td>
                      <td>
                        <input type="number" min={0} className="w-full rounded border px-2 py-1.5 text-right tabular-nums" value={line.unitCost} onChange={(e) => {
                          const lines = [...newPo.lines];
                          lines[idx] = { ...lines[idx], unitCost: Number(e.target.value) || 0 };
                          setNewPo({ ...newPo, lines });
                        }} />
                      </td>
                      <td className="text-right font-medium tabular-nums">${(line.qty * line.unitCost).toLocaleString()}</td>
                      <td>
                        {newPo.lines.length > 1 && (
                          <button type="button" className="text-red-500 hover:bg-red-50 rounded p-1" onClick={() => setNewPo({ ...newPo, lines: newPo.lines.filter((_, i) => i !== idx) })} aria-label="刪除列">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-blue-600 hover:underline"
                onClick={() => setNewPo({ ...newPo, lines: [...newPo.lines, { productId: '', qty: 1, unitCost: 0 }] })}
              >
                + 新增品項
              </button>
              <p className="mt-3 text-right text-sm font-bold text-neutral-900">合計: ${totalDraft.toLocaleString()}</p>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-neutral-700">備註</label>
              <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" rows={3} value={newPo.remark} onChange={(e) => setNewPo({ ...newPo, remark: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <button type="button" onClick={createPo} className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                建立採購單
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
