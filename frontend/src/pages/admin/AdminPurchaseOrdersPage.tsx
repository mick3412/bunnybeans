import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  listPurchaseOrders,
  listSuppliers,
  getPurchaseOrder,
  createPurchaseOrder,
  submitPo,
  cancelPo,
  poTotal,
  listReceivingNotes,
  type ReceivingNoteDto,
  type PurchaseOrderDto,
  type PoStatus,
  type ApiError,
} from '../../modules/admin/purchaseApi';
import { getProducts, getWarehouses } from '../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
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
    PARTIALLY_RECEIVED: 'bg-brand-primary/10 text-brand-primary',
    DRAFT: 'bg-[#e2e8f0] text-muted',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return styles[s] ?? 'bg-[#f1f5f9] text-muted';
}

type LineDraft = { productId: string; qty: number; unitCost: number };

export const AdminPurchaseOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PurchaseOrderDto[]>([]);
  const [detail, setDetail] = useState<PurchaseOrderDto | null>(null);
  const [detailRns, setDetailRns] = useState<ReceivingNoteDto[]>([]);
  const [detailRnLoading, setDetailRnLoading] = useState(false);
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

  const detailProgress = useMemo(() => {
    if (!detail) return { ordered: 0, received: 0, pct: 0 };
    const lines = detail.lines ?? [];
    const ordered = lines.reduce((s, l) => s + (Number(l.qtyOrdered) || 0), 0);
    const received = lines.reduce((s, l) => s + (Number(l.qtyReceived) || 0), 0);
    const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
    return { ordered, received, pct };
  }, [detail]);

  const load = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    if (!merchantId) {
      setListLoading(false);
      setRows([]);
      setSuppliers([]);
      return;
    }
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
    void (async () => {
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

  const openDetail = useCallback(async (id: string) => {
    const out = await getPurchaseOrder(id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    setDetail(out);
    if (merchantId) {
      setDetailRnLoading(true);
      const rns = await listReceivingNotes(merchantId);
      setDetailRnLoading(false);
      if (rns.error) {
        setDetailRns([]);
      } else {
        setDetailRns(rns.data.filter((x) => x.purchaseOrderId === id));
      }
    } else {
      setDetailRns([]);
    }
  }, [merchantId, showToast]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    void openDetail(id);
    setSearchParams({}, { replace: true });
  }, [openDetail, searchParams, setSearchParams]);

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
      showToast('缺少供應商', 'err');
      return;
    }
    const validLines = newPo.lines.filter((l) => l.productId && l.qty > 0);
    if (!validLines.length) {
      showToast('至少需要一列訂購品項', 'err');
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
    <div className="mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm" data-testid="e2e-admin-purchase-orders">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#64748b]">建立與追蹤採購訂單</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/purchase-orders/quick-receiving')}
            className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-semibold text-content hover:border-brand-primary/30"
          >
            快速進貨
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover"
          >
            + 新增採購單
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-10 pr-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
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
              status === t.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-muted hover:text-content'
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" aria-label="載入中" />
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold uppercase text-muted">
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
                    <td className="px-4 py-3.5 text-content">{p.supplierName ?? '—'}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums">{(p.lines ?? []).length}</td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums">${poTotal({ ...p, lines: p.lines ?? [] }).toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold ${statusPill(p.status)}`}>{statusLabel(p.status)}</span>
                    </td>
                    <td className="px-2 py-3.5 text-muted" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 hover:text-brand-primary" onClick={() => openDetail(p.id)} aria-label="詳情">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listError && rows.length === 0 && <div className="py-16 text-center text-muted">尚無採購單</div>}
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">{detail.orderNumber}</h2>
              <button type="button" className="text-muted hover:text-muted" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>
            <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusPill(detail.status)}`}>{statusLabel(detail.status)}</span>
            <p className="mt-2 text-sm text-muted">供應商：{detail.supplierName ?? '—'}</p>
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-content">驗收進度</span>
                <span className="text-sm tabular-nums text-content">
                  {detailProgress.received} / {detailProgress.ordered}（{detailProgress.pct}%）
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#e2e8f0]">
                <div className="h-2 rounded-full bg-brand-primary" style={{ width: `${detailProgress.pct}%` }} />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-content">進貨追蹤</span>
                {detailRnLoading && <span className="text-xs text-muted">載入驗收單…</span>}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <div className="text-xs font-semibold text-content">採購單</div>
                  <div className="mt-1 text-xs text-muted">
                    狀態：{statusLabel(detail.status)}
                    {detail.orderDate ? ` · 下單 ${detail.orderDate.slice(0, 10)}` : ''}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">完成率：{detailProgress.pct}%</div>
                </div>
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <div className="text-xs font-semibold text-content">驗收單</div>
                  <div className="mt-1 text-xs text-muted">
                    {detailRns.length === 0
                      ? '尚無驗收單'
                      : `共 ${detailRns.length} 筆（${detailRns.filter((x) => x.status === 'COMPLETED').length} 筆已完成）`}
                  </div>
                </div>
              </div>
              {detailRns.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-muted">
                      <tr>
                        <th className="px-2 py-2 text-left">驗收單號</th>
                        <th className="px-2 py-2">狀態</th>
                        <th className="px-2 py-2 text-right">時間</th>
                        <th className="w-20 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {detailRns.map((rn) => (
                        <tr
                          key={rn.id}
                          className="cursor-pointer border-b border-neutral-50 hover:bg-neutral-50/80"
                          onClick={() => {
                            setDetail(null);
                            navigate(`/admin/receiving-notes?id=${encodeURIComponent(rn.id)}`);
                          }}
                          title="前往驗收詳情"
                        >
                          <td className="px-2 py-2 font-mono text-xs text-sky-700 hover:underline">{rn.number}</td>
                          <td className="px-2 py-2 text-xs">
                            <span
                              className={[
                                'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
                                rn.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rn.status === 'IN_PROGRESS'
                                    ? 'bg-brand-primary/10 text-brand-primary'
                                    : rn.status === 'PENDING'
                                      ? 'bg-orange-100 text-orange-800'
                                      : rn.status === 'RETURNED'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-[#e2e8f0] text-muted',
                              ].join(' ')}
                            >
                              {rn.status === 'COMPLETED'
                                ? '已完成'
                                : rn.status === 'IN_PROGRESS'
                                  ? '驗收中'
                                  : rn.status === 'PENDING'
                                    ? '待驗收'
                                    : rn.status === 'RETURNED'
                                      ? '已退回'
                                      : rn.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-muted">
                            {rn.receivedAt ? rn.receivedAt.slice(0, 10) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-muted">前往</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc]">
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
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-modal="true" role="dialog" aria-labelledby="create-po-title">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
                <div>
                  <h2 id="create-po-title" className="text-xl font-semibold tracking-tight text-neutral-900">新增採購單</h2>
                  <p className="mt-1 text-sm text-neutral-500">建立新的採購訂單</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                  onClick={() => setCreateOpen(false)}
                  aria-label="關閉"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="space-y-6 px-6 py-5">
                {/* 基本資訊 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      供應商 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={newPo.supplierId}
                      onChange={(e) => setNewPo({ ...newPo, supplierId: e.target.value })}
                    >
                      <option value="">選擇供應商</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">預計到貨日</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={newPo.expectedDate}
                      onChange={(e) => setNewPo({ ...newPo, expectedDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* 訂購品項 */}
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/80">
                  <div className="border-b border-neutral-200 bg-white px-4 py-3">
                    <h3 className="text-sm font-semibold text-neutral-800">訂購品項</h3>
                  </div>
                  <div className="p-4">
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50">
                            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">商品</th>
                            <th className="w-20 px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">數量</th>
                            <th className="w-24 px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">單價</th>
                            <th className="w-24 px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">小計</th>
                            <th className="w-12 px-2 py-3" aria-hidden />
                          </tr>
                        </thead>
                        <tbody>
                          {newPo.lines.map((line, idx) => (
                            <tr key={idx} className="border-b border-neutral-100 last:border-0">
                              <td className="px-3 py-2.5">
                                <select
                                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                  value={line.productId}
                                  onChange={(e) => {
                                    const lines = [...newPo.lines];
                                    lines[idx] = { ...lines[idx], productId: e.target.value };
                                    setNewPo({ ...newPo, lines });
                                  }}
                                >
                                  <option value="">選擇商品</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.sku} {p.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  min={1}
                                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm tabular-nums transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:placeholder:text-neutral-400"
                                  value={line.qty}
                                  onChange={(e) => {
                                    const lines = [...newPo.lines];
                                    lines[idx] = { ...lines[idx], qty: Number(e.target.value) || 0 };
                                    setNewPo({ ...newPo, lines });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm tabular-nums transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:placeholder:text-neutral-400"
                                  value={line.unitCost}
                                  onChange={(e) => {
                                    const lines = [...newPo.lines];
                                    lines[idx] = { ...lines[idx], unitCost: Number(e.target.value) || 0 };
                                    setNewPo({ ...newPo, lines });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium tabular-nums text-neutral-900">${(line.qty * line.unitCost).toLocaleString()}</td>
                              <td className="px-2 py-2.5">
                                {newPo.lines.length > 1 && (
                                  <button
                                    type="button"
                                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    onClick={() => setNewPo({ ...newPo, lines: newPo.lines.filter((_, i) => i !== idx) })}
                                    aria-label="刪除此列"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-600 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
                      onClick={() => setNewPo({ ...newPo, lines: [...newPo.lines, { productId: '', qty: 1, unitCost: 0 }] })}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      新增品項
                    </button>
                    <p className="mt-3 text-right text-sm font-semibold text-neutral-900">合計：${totalDraft.toLocaleString()}</p>
                  </div>
                </div>

                {/* 備註 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">備註</label>
                  <textarea
                    className="w-full min-h-[80px] resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    rows={3}
                    placeholder="選填"
                    value={newPo.remark}
                    onChange={(e) => setNewPo({ ...newPo, remark: e.target.value })}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-neutral-200 bg-neutral-50/50 px-6 py-4">
                <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={createPo}>
                  建立採購單
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
