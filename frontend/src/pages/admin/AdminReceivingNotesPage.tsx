import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  listReceivingNotes,
  listPurchaseOrdersReceivable,
  createReceivingNote,
  getReceivingNote,
  getPurchaseOrder,
  patchReceivingNoteLines,
  completeReceivingNote,
  rejectReceivingNote,
  MOCK_MERCHANT,
  type ReceivingNoteDto,
  type RnStatus,
  type PurchaseOrderDto,
  type PoLineDto,
} from '../../modules/admin/purchaseApi';
import { listMerchants } from '../../modules/admin/adminApi';
import { useAdminToast } from './AdminToastContext';

const RN_STATUS: { key: string; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待驗收' },
  { key: 'IN_PROGRESS', label: '驗收中' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'RETURNED', label: '已退回' },
];

function rnLabel(s: RnStatus) {
  const m: Record<string, string> = {
    PENDING: '待驗收',
    IN_PROGRESS: '驗收中',
    COMPLETED: '已完成',
    RETURNED: '已退回',
  };
  return m[s] ?? s;
}

type LineDraft = { receivedQty: number; returnedQty: number };

export const AdminReceivingNotesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useAdminToast();
  const [merchantId, setMerchantId] = useState(MOCK_MERCHANT);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ReceivingNoteDto[]>([]);
  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrderDto[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [newRn, setNewRn] = useState({ purchaseOrderId: '', inspectorName: '', remark: '' });
  const [detail, setDetail] = useState<ReceivingNoteDto | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadPoLines = async (poId: string) => {
    if (!poId) {
      setSelectedPo(null);
      setLineDrafts({});
      return;
    }
    const out = await getPurchaseOrder(poId);
    if ('statusCode' in out) {
      setSelectedPo(null);
      return;
    }
    setSelectedPo(out);
    const drafts: Record<string, LineDraft> = {};
    for (const l of out.lines ?? []) {
      const pending = Math.max(0, l.qtyOrdered - l.qtyReceived);
      drafts[l.id] = { receivedQty: pending, returnedQty: 0 };
    }
    setLineDrafts(drafts);
  };

  const load = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const rn = await listReceivingNotes(merchantId, status, q || undefined);
    const pos = await listPurchaseOrdersReceivable(merchantId);
    setListLoading(false);
    const err = rn.error ?? pos.error;
    if (err) {
      setListError(err.message);
      setRows([]);
      setReceivablePOs([]);
      showToast(err.message, 'err');
      return;
    }
    setRows(rn.data);
    setReceivablePOs(pos.data);
  }, [merchantId, status, q, showToast]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) setMerchantId((prev) => (prev === MOCK_MERCHANT ? m[0].id : prev));
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => loadRef.current(), 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const newPo = searchParams.get('newPo');
    if (newPo) {
      setNewRn((n) => ({ ...n, purchaseOrderId: newPo }));
      setCreateOpen(true);
      loadPoLines(newPo);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openCreate = () => {
    setCreateOpen(true);
    setNewRn({ purchaseOrderId: '', inspectorName: '', remark: '' });
    setSelectedPo(null);
    setLineDrafts({});
  };

  const openDetail = async (id: string) => {
    const out = await getReceivingNote(id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    setDetail(out);
  };

  const createRn = async () => {
    if (!newRn.purchaseOrderId || !selectedPo) {
      showToast('請選採購單', 'err');
      return;
    }
    const lineInputs = (selectedPo.lines ?? []).map((l) => ({
      poLineId: l.id,
      receivedQty: lineDrafts[l.id]?.receivedQty ?? 0,
      returnedQty: lineDrafts[l.id]?.returnedQty ?? 0,
    }));
    const out = await createReceivingNote({
      merchantId,
      purchaseOrderId: newRn.purchaseOrderId,
      inspectorName: newRn.inspectorName || undefined,
      remark: newRn.remark || undefined,
      lineInputs,
    });
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    showToast('已建立驗收單', 'ok');
    setCreateOpen(false);
    setNewRn({ purchaseOrderId: '', inspectorName: '', remark: '' });
    setSelectedPo(null);
    setLineDrafts({});
    load();
    openDetail(out.id);
  };

  const saveLine = async (lineId: string, patch: { qualifiedQty?: number; returnedQty?: number; returnReason?: string }) => {
    if (!detail) return;
    const out = await patchReceivingNoteLines(detail.id, [{ lineId, ...patch }]);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    setDetail(out);
    load();
  };

  const pendingQty = (l: PoLineDto) => Math.max(0, l.qtyOrdered - l.qtyReceived);

  return (
    <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100" data-testid="e2e-admin-receiving-notes">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">進貨驗收</h1>
          <p className="mt-1 text-sm text-neutral-500">驗收入庫與差異處理</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          + 新增驗收單
        </button>
      </div>
      <div className="mb-4">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/80 py-2.5 pl-10 pr-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            placeholder="搜尋驗收單號 / 採購單號 / 供應商..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {RN_STATUS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              status === t.key ? 'border-violet-600 text-violet-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" aria-label="載入中" />
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50/90 text-xs font-semibold uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">驗收單號</th>
                  <th className="px-4 py-3">採購單號</th>
                  <th className="px-4 py-3">供應商</th>
                  <th className="px-4 py-3 text-center">品項數</th>
                  <th className="px-4 py-3">驗收人員</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3">驗收日期</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-b border-neutral-50 hover:bg-neutral-50/80" onClick={() => openDetail(r.id)}>
                    <td className="px-4 py-3.5 font-mono text-xs font-medium">{r.number}</td>
                    <td className="px-4 py-3.5">{r.poNumber ?? '—'}</td>
                    <td className="px-4 py-3.5 text-neutral-800">{r.supplierName ?? '—'}</td>
                    <td className="px-4 py-3.5 text-center">{(r.lines ?? []).length}</td>
                    <td className="px-4 py-3.5">{r.inspectorName ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-900">{rnLabel(r.status)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-500">{r.receivedAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-2 py-3.5 text-neutral-400" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 hover:text-violet-600" onClick={() => openDetail(r.id)} aria-label="詳情">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listError && rows.length === 0 && <div className="py-16 text-center text-neutral-500">尚無驗收單</div>}
          </>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">新增驗收單</h2>
                <p className="mt-1 text-sm text-neutral-500">從採購單建立驗收紀錄</p>
              </div>
              <button type="button" className="text-neutral-400 hover:text-neutral-700" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  採購單 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
                  value={newRn.purchaseOrderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewRn({ ...newRn, purchaseOrderId: id });
                    loadPoLines(id);
                  }}
                >
                  <option value="">選擇採購單</option>
                  {receivablePOs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.orderNumber} - {p.supplierName ?? ''}
                    </option>
                  ))}
                </select>
                {receivablePOs.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">尚無可驗收採購單，請先將採購單下單（已下單或部分到貨）。</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">驗收人員</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
                  value={newRn.inspectorName}
                  onChange={(e) => setNewRn({ ...newRn, inspectorName: e.target.value })}
                  placeholder="姓名"
                />
              </div>
            </div>

            {selectedPo && selectedPo.lines.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-neutral-800">驗收品項</h3>
                <table className="mt-2 w-full text-sm">
                  <thead className="border-b text-left text-xs text-neutral-500">
                    <tr>
                      <th className="py-2 pr-2">商品</th>
                      <th className="w-28 py-2 text-right">待收數量</th>
                      <th className="w-28 py-2 text-right">實收數量</th>
                      <th className="w-28 py-2 text-right">退回數量</th>
                      <th className="w-28 py-2 text-right">合格數量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPo.lines.map((l) => {
                      const pending = pendingQty(l);
                      const d = lineDrafts[l.id] ?? { receivedQty: pending, returnedQty: 0 };
                      const qualified = Math.max(0, d.receivedQty - d.returnedQty);
                      return (
                        <tr key={l.id} className="border-b border-neutral-100">
                          <td className="py-3 pr-2">
                            <span className="font-medium text-neutral-900">{l.name ?? '—'}</span>
                            <span className="ml-2 text-xs text-neutral-400">{l.sku ?? ''}</span>
                          </td>
                          <td className="py-3 text-right tabular-nums text-neutral-600">{pending} 件</td>
                          <td className="py-3">
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-right tabular-nums"
                              value={d.receivedQty}
                              onChange={(e) =>
                                setLineDrafts({
                                  ...lineDrafts,
                                  [l.id]: { ...d, receivedQty: Number(e.target.value) || 0 },
                                })
                              }
                            />
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-right tabular-nums"
                              value={d.returnedQty}
                              onChange={(e) =>
                                setLineDrafts({
                                  ...lineDrafts,
                                  [l.id]: { ...d, returnedQty: Number(e.target.value) || 0 },
                                })
                              }
                            />
                          </td>
                          <td className="py-3 text-right text-sm font-semibold tabular-nums text-emerald-600">{qualified}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-neutral-700">備註</label>
              <textarea
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                rows={3}
                value={newRn.remark}
                onChange={(e) => setNewRn({ ...newRn, remark: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border-2 border-violet-600 bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={createRn}
                disabled={!selectedPo}
                className="rounded-lg bg-[#6366f1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                建立驗收單
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">{detail.number}</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>
            <p className="text-sm text-neutral-600">
              採購單 {detail.poNumber} ｜ {detail.supplierName} ｜ 驗收人：{detail.inspectorName ?? '—'}
            </p>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b bg-neutral-50">
                <tr>
                  <th className="px-2 py-2 text-left">訂購（待收）</th>
                  <th className="px-2 py-2 text-right">實收</th>
                  <th className="px-2 py-2 text-right">合格</th>
                  <th className="px-2 py-2 text-right">退回</th>
                  <th className="px-2 py-2 text-left">退回原因</th>
                </tr>
              </thead>
              <tbody>
                {(detail.lines ?? []).map((ln) => (
                  <tr key={ln.id} className="border-b">
                    <td className="px-2 py-2">{ln.orderedQty}</td>
                    <td className="px-2 py-2 text-right">{ln.receivedQty}</td>
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        <span className="tabular-nums">{ln.qualifiedQty}</span>
                      ) : (
                        <input
                          type="number"
                          className="w-20 rounded border px-2 py-1 text-right"
                          value={ln.qualifiedQty}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, qualifiedQty: Number(e.target.value) } : l,
                              ),
                            })
                          }
                          onBlur={() => saveLine(ln.id, { qualifiedQty: ln.qualifiedQty })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        <span className="tabular-nums">{ln.returnedQty}</span>
                      ) : (
                        <input
                          type="number"
                          className="w-20 rounded border px-2 py-1 text-right"
                          value={ln.returnedQty}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, returnedQty: Number(e.target.value) } : l,
                              ),
                            })
                          }
                          onBlur={() => saveLine(ln.id, { returnedQty: ln.returnedQty })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        ln.returnReason ?? '—'
                      ) : (
                        <input
                          className="w-full min-w-[120px] rounded border px-2 py-1 text-xs"
                          value={ln.returnReason ?? ''}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, returnReason: e.target.value } : l,
                              ),
                            })
                          }
                          onBlur={() => saveLine(ln.id, { returnReason: ln.returnReason ?? '' })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.status !== 'COMPLETED' && detail.status !== 'RETURNED' && (
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={async () => {
                    const out = await completeReceivingNote(detail.id);
                    if ('statusCode' in out) {
                      showToast(out.message, 'err');
                      return;
                    }
                    showToast('已完成驗收（合格數入庫）', 'ok');
                    setDetail(null);
                    await load();
                  }}
                >
                  完成驗收
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600"
                  onClick={async () => {
                    const out = await rejectReceivingNote(detail.id);
                    if ('statusCode' in out) {
                      showToast(out.message, 'err');
                      return;
                    }
                    showToast('已退回', 'ok');
                    setDetail(out);
                    load();
                  }}
                >
                  退回
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
