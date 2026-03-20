import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  getExpiringInventory,
  getExpiringInventorySummaryByProduct,
  type ExpiringBatchRow,
  type ExpiringInventoryResult,
  type ExpiringProductSummaryRow,
  type ApiError as AdminApiError,
} from '../../modules/admin/adminApi';
import {
  listReceivingNotes,
  listPurchaseOrdersReceivable,
  createReceivingNote,
  getReceivingNote,
  getPurchaseOrder,
  patchReceivingNoteLines,
  completeReceivingNote,
  rejectReceivingNote,
  returnToSupplier,
  type ReceivingNoteDto,
  type RnStatus,
  type PurchaseOrderDto,
  type PoLineDto,
} from '../../modules/admin/purchaseApi';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { Alert } from '../../shared/components/Alert';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Modal } from '../../shared/components/Modal';
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
  const navigate = useNavigate();
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ReceivingNoteDto[]>([]);
  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrderDto[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [newRn, setNewRn] = useState({ purchaseOrderId: '', inspectorName: '', remark: '' });
  const [detail, setDetail] = useState<ReceivingNoteDto | null>(null);
  const [detailPo, setDetailPo] = useState<PurchaseOrderDto | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState<Record<string, string>>({});
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [createRnSubmitting, setCreateRnSubmitting] = useState(false);
  const [returnLastSubmitted, setReturnLastSubmitted] = useState<
    Array<{ lineId: string; qty: number; reason: string }> | null
  >(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [expiringDetail, setExpiringDetail] = useState<ExpiringBatchRow[] | null>(null);
  const [expiringDetailLoading, setExpiringDetailLoading] = useState(false);
  const [expiringDetailError, setExpiringDetailError] = useState<string | null>(null);
  const [expiringPanelOpen, setExpiringPanelOpen] = useState(false);
  const [expiringPanelTab, setExpiringPanelTab] = useState<'product' | 'batch'>('product');
  const [expiringPanelDaysAhead, setExpiringPanelDaysAhead] = useState(30);
  const [expiringPanelLoading, setExpiringPanelLoading] = useState(false);
  const [expiringPanelError, setExpiringPanelError] = useState<string | null>(null);
  const [expiringPanelProductRows, setExpiringPanelProductRows] = useState<ExpiringProductSummaryRow[]>([]);
  const [expiringPanelBatchRows, setExpiringPanelBatchRows] = useState<ExpiringBatchRow[]>([]);

  const loadExpiringPanel = useCallback(async (warehouseId: string) => {
    setExpiringPanelLoading(true);
    setExpiringPanelError(null);
    const out =
      expiringPanelTab === 'product'
        ? await getExpiringInventorySummaryByProduct({
            warehouseId,
            daysAhead: expiringPanelDaysAhead,
            page: 1,
            pageSize: 50,
          })
        : await getExpiringInventory({
            warehouseId,
            daysAhead: expiringPanelDaysAhead,
            pageSize: 50,
          });
    setExpiringPanelLoading(false);
    const maybeErr = out as unknown as AdminApiError;
    if ('statusCode' in maybeErr && typeof maybeErr.statusCode === 'number') {
      setExpiringPanelError(maybeErr.message);
      setExpiringPanelProductRows([]);
      setExpiringPanelBatchRows([]);
      return;
    }
    if (expiringPanelTab === 'product') {
      const d = out as unknown as { items: ExpiringProductSummaryRow[] };
      setExpiringPanelProductRows(Array.isArray(d.items) ? d.items : []);
      setExpiringPanelBatchRows([]);
    } else {
      const d = out as unknown as ExpiringInventoryResult;
      setExpiringPanelBatchRows(Array.isArray(d.items) ? d.items : []);
      setExpiringPanelProductRows([]);
    }
  }, [expiringPanelDaysAhead, expiringPanelTab]);

  useEffect(() => {
    if (detail?.id) setReturnQty({});
  }, [detail?.id]);
  useEffect(() => {
    if (detail?.id) setReturnReason({});
  }, [detail?.id]);

  useEffect(() => {
    if (!detail?.purchaseOrderId) {
      setDetailPo(null);
      return;
    }
    void (async () => {
      const out = await getPurchaseOrder(detail.purchaseOrderId);
      if ('statusCode' in out) {
        setDetailPo(null);
        return;
      }
      setDetailPo(out);
    })();
  }, [detail?.purchaseOrderId]);

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
    if (!merchantId) {
      setListLoading(false);
      setRows([]);
      setReceivablePOs([]);
      return;
    }
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

  // id deep link 會在 openDetail 宣告後處理

  const openCreate = () => {
    setCreateOpen(true);
    setNewRn({ purchaseOrderId: '', inspectorName: '', remark: '' });
    setSelectedPo(null);
    setLineDrafts({});
  };

  const openDetail = useCallback(async (id: string) => {
    const out = await getReceivingNote(id);
    if ('statusCode' in out) {
      showToast(out.message, 'err');
      return;
    }
    setDetail(out);
    setExpiringDetail(null);
    setExpiringDetailError(null);
    if (out.warehouseId) {
      setExpiringDetailLoading(true);
      const res = await getExpiringInventory({
        warehouseId: out.warehouseId,
        daysAhead: 30,
        pageSize: 50,
      });
      setExpiringDetailLoading(false);
      const maybeErr = res as unknown as AdminApiError;
      if ('statusCode' in maybeErr && typeof maybeErr.statusCode === 'number') {
        setExpiringDetailError(maybeErr.message);
        setExpiringDetail(null);
      } else {
        const data = res as unknown as ExpiringInventoryResult;
        setExpiringDetail(Array.isArray(data.items) ? data.items : []);
      }
    }
  }, [showToast]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    void openDetail(id);
    setSearchParams({}, { replace: true });
  }, [openDetail, searchParams, setSearchParams]);

  useEffect(() => {
    if (!expiringPanelOpen) return;
    if (!detail?.warehouseId) return;
    void loadExpiringPanel(detail.warehouseId);
  }, [detail?.warehouseId, expiringPanelDaysAhead, expiringPanelOpen, expiringPanelTab, loadExpiringPanel]);

  const createRn = async () => {
    if (!newRn.purchaseOrderId || !selectedPo) {
      showToast('缺少採購單', 'err');
      return;
    }
    setCreateRnSubmitting(true);
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
    setCreateRnSubmitting(false);
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

  const saveLine = async (lineId: string, patch: {
    qualifiedQty?: number;
    returnedQty?: number;
    returnReason?: string;
    batchCode?: string | null;
    expiryDate?: string | null;
    weightUnit?: string | null;
  }) => {
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
    <>
    <StandardListLayout
      title="進貨驗收／退供"
      description="驗收入庫與差異處理"
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover"
        >
          + 新增驗收單
        </button>
      }
      filters={
        <div className="flex flex-col gap-4">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <label htmlFor="admin-rn-search" className="sr-only">
              搜尋驗收單號、採購單號或供應商
            </label>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="admin-rn-search"
              aria-label="搜尋驗收單號、採購單號或供應商"
              className="w-full rounded-lg border border-brand-surface bg-table-head py-2.5 pl-10 pr-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              placeholder="搜尋驗收單號 / 採購單號 / 供應商..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1 border-b border-brand-surface">
            {RN_STATUS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  status === t.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-muted hover:text-content'
                }`}
                onClick={() => setStatus(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      }
      loading={listLoading}
      error={null}
      aboveContent={listError ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Alert variant="error">載入失敗：{listError}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void load()}>重試</Button>
        </div>
      ) : undefined}
      empty={!listLoading && !listError && rows.length === 0}
      emptyMessage="尚無驗收單"
      testId="e2e-admin-receiving-notes"
    >
      {!listLoading && rows.length > 0 && (
      <div className="overflow-hidden rounded-xl border border-brand-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
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
                  <tr key={r.id} className="cursor-pointer border-b border-brand-surface hover:bg-table-head" onClick={() => openDetail(r.id)}>
                    <td className="px-4 py-3.5 font-mono text-xs font-medium">{r.number}</td>
                    <td className="px-4 py-3.5">{r.poNumber ?? '—'}</td>
                    <td className="px-4 py-3.5 text-content">{r.supplierName ?? '—'}</td>
                    <td className="px-4 py-3.5 text-center">{(r.lines ?? []).length}</td>
                    <td className="px-4 py-3.5">{r.inspectorName ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-md bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">{rnLabel(r.status)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{r.receivedAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-2 py-3.5 text-muted" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 hover:text-brand-primary" onClick={() => openDetail(r.id)} aria-label="詳情">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
      </div>
      )}
    </StandardListLayout>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        labelledBy="admin-rn-create-title"
        className="z-50"
        panelClassName="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
            <div className="max-h-[92vh] overflow-y-auto p-6">
            <div className="flex justify-between">
              <div>
                <h2 id="admin-rn-create-title" className="text-xl font-bold text-content">新增驗收單</h2>
                <p className="mt-1 text-sm text-muted">從採購單建立驗收紀錄</p>
              </div>
              <button type="button" className="text-muted hover:text-muted" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted">
                  採購單 <span className="text-brand-danger">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-brand-surface px-3 py-2.5 text-sm"
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
                  <p className="mt-2 text-sm text-amber-700">尚無可驗收採購單。</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted">驗收人員</label>
                <input
                  className="w-full rounded-lg border border-brand-surface px-3 py-2.5 text-sm"
                  value={newRn.inspectorName}
                  onChange={(e) => setNewRn({ ...newRn, inspectorName: e.target.value })}
                  placeholder="姓名"
                />
              </div>
            </div>

            {selectedPo && selectedPo.lines.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-brand-surface bg-table-head p-4">
                <h3 className="text-sm font-semibold text-content">驗收品項</h3>
                <table className="mt-3 w-full text-sm">
                  <thead className="border-b border-brand-surface text-left text-xs text-muted">
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
                        <tr key={l.id} className="border-b border-brand-surface">
                          <td className="py-3 pr-2">
                            <span className="font-medium text-content">{l.name ?? '—'}</span>
                            <span className="ml-2 text-xs text-muted">{l.sku ?? ''}</span>
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted">{pending} 件</td>
                          <td className="py-3">
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-xl border border-brand-surface px-2.5 py-2 text-right text-sm tabular-nums"
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
                              className="w-full rounded-xl border border-brand-surface px-2.5 py-2 text-right text-sm tabular-nums"
                              value={d.returnedQty}
                              onChange={(e) =>
                                setLineDrafts({
                                  ...lineDrafts,
                                  [l.id]: { ...d, returnedQty: Number(e.target.value) || 0 },
                                })
                              }
                            />
                          </td>
                          <td className="py-3 text-right text-sm font-semibold tabular-nums text-brand-success">{qualified}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6">
              <label className="mb-1 block text-sm font-medium text-muted">備註</label>
              <textarea
                className="w-full rounded-lg border border-brand-surface px-3 py-2 text-sm"
                rows={3}
                value={newRn.remark}
                onChange={(e) => setNewRn({ ...newRn, remark: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-brand-surface pt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border-2 border-brand-primary bg-white px-5 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void createRn()}
                disabled={!selectedPo || createRnSubmitting}
                className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {createRnSubmitting ? '建立中…' : '建立驗收單'}
              </button>
            </div>
            </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        labelledBy="admin-rn-detail-title"
        className="z-50"
        panelClassName="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {detail ? (
          <div className="max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between">
              <h2 id="admin-rn-detail-title" className="text-lg font-semibold">{detail.number}</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-muted hover:text-muted">
                ✕
              </button>
            </div>
            <p className="text-sm text-muted">
              採購單 {detail.poNumber} ｜ {detail.supplierName} ｜ 驗收人：{detail.inspectorName ?? '—'}
            </p>
            {detail.warehouseId && (
              <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-900">
                    近 30 天此倉庫即將到期批次
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setExpiringPanelOpen(true);
                      void loadExpiringPanel(detail.warehouseId!);
                    }}
                  >
                    查看即期庫存面板
                  </Button>
                  {expiringDetailLoading && (
                    <span className="text-[11px] text-amber-700">載入中…</span>
                  )}
                </div>
                {expiringDetailError && (
                  <p className="text-[11px] text-amber-900">無法載入批次：{expiringDetailError}</p>
                )}
                {!expiringDetailError &&
                  !expiringDetailLoading &&
                  (!expiringDetail || expiringDetail.length === 0) && (
                    <p className="text-[11px] text-amber-800">
                      目前沒有設定效期的庫存批次。
                    </p>
                  )}
                {!expiringDetailError && expiringDetail && expiringDetail.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-amber-100 bg-white/80">
                    <table className="w-full border-collapse text-[11px]">
                      <thead className="bg-amber-100 text-amber-900">
                        <tr>
                          <th className="px-2 py-1 text-left">商品</th>
                          <th className="px-2 py-1 text-left">批號</th>
                          <th className="px-2 py-1 text-left">效期日</th>
                          <th className="px-2 py-1 text-right">庫存數</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiringDetail.map((b) => (
                          <tr
                            key={`${b.productId}-${b.warehouseId}-${b.batchCode ?? 'none'}-${b.expiryDate}`}
                            className="border-t border-amber-100"
                          >
                            <td className="px-2 py-1">
                              <span className="text-[11px] font-medium text-amber-900">
                                {b.productName ?? '—'}
                              </span>
                              {b.sku && (
                                <span className="ml-1 font-mono text-[10px] text-amber-700">
                                  {b.sku}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 font-mono">{b.batchCode ?? '—'}</td>
                            <td className="px-2 py-1">{b.expiryDate.slice(0, 10)}</td>
                            <td className="px-2 py-1 text-right font-mono">{b.onHandQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <Modal
              open={expiringPanelOpen && !!detail.warehouseId}
              onClose={() => setExpiringPanelOpen(false)}
              labelledBy="admin-rn-expiring-panel-title"
              className="z-[60]"
              panelClassName="w-full max-w-4xl rounded-2xl border border-brand-surface bg-white p-4 shadow-xl"
            >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id="admin-rn-expiring-panel-title" className="text-sm font-semibold text-content">即期庫存監控</h2>
                      <div className="mt-0.5 text-xs text-muted">
                        warehouseId：<span className="font-mono">{detail.warehouseId}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-brand-surface px-2 py-1 text-xs text-muted hover:bg-table-head"
                      onClick={() => setExpiringPanelOpen(false)}
                    >
                      關閉
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap items-end gap-2">
                    <div className="flex items-center gap-2 rounded-full bg-table-head px-2 py-1">
                      <button
                        type="button"
                        className={[
                          'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                          expiringPanelTab === 'product'
                            ? 'bg-forge-sidebar text-white shadow-sm'
                            : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
                        ].join(' ')}
                        onClick={() => setExpiringPanelTab('product')}
                      >
                        依商品彙總
                      </button>
                      <button
                        type="button"
                        className={[
                          'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                          expiringPanelTab === 'batch'
                            ? 'bg-forge-sidebar text-white shadow-sm'
                            : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
                        ].join(' ')}
                        onClick={() => setExpiringPanelTab('batch')}
                      >
                        依批次明細
                      </button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">daysAhead</label>
                      <input
                        type="number"
                        min={1}
                        className="h-9 w-28 rounded-lg border border-brand-surface bg-white px-3 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        value={expiringPanelDaysAhead}
                        onChange={(e) => setExpiringPanelDaysAhead(Math.max(1, Number(e.target.value || 1)))}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void loadExpiringPanel(detail.warehouseId!)}
                      disabled={expiringPanelLoading}
                    >
                      {expiringPanelLoading ? '載入中…' : '重新整理'}
                    </Button>
                    {expiringPanelError ? <div className="text-xs text-brand-danger">{expiringPanelError}</div> : null}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-brand-surface">
                    {expiringPanelLoading ? (
                      <div className="px-4 py-8 text-center text-sm text-muted">載入中…</div>
                    ) : expiringPanelTab === 'product' ? (
                      expiringPanelProductRows.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted">沒有即期商品</div>
                      ) : (
                        <div className="table-sticky-head overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                              <tr>
                                <th className="px-4 py-2">SKU</th>
                                <th className="px-4 py-2">商品</th>
                                <th className="px-4 py-2">最早到期</th>
                                <th className="px-4 py-2">即期總量</th>
                                <th className="px-4 py-2">倉庫數</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expiringPanelProductRows.map((r) => (
                                <tr key={r.productId} className="border-t border-brand-surface hover:bg-brand-canvas">
                                  <td className="px-4 py-2 font-mono text-xs text-content">{r.sku ?? '—'}</td>
                                  <td className="px-4 py-2 text-content">{r.productName ?? r.productId.slice(0, 8) + '…'}</td>
                                  <td className="px-4 py-2 tabular-nums text-muted">{r.earliestExpiryDate}</td>
                                  <td className="px-4 py-2 tabular-nums text-content">{r.expiringQty}</td>
                                  <td className="px-4 py-2 tabular-nums text-muted">{r.warehousesCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : expiringPanelBatchRows.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-muted">沒有即期批次</div>
                    ) : (
                      <div className="table-sticky-head overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                            <tr>
                              <th className="px-4 py-2">SKU</th>
                              <th className="px-4 py-2">商品</th>
                              <th className="px-4 py-2">批次</th>
                              <th className="px-4 py-2">到期日</th>
                              <th className="px-4 py-2">數量</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expiringPanelBatchRows.map((b, idx) => (
                              <tr
                                key={`${b.productId}-${b.warehouseId}-${b.batchCode ?? 'none'}-${b.expiryDate}-${idx}`}
                                className="border-t border-brand-surface hover:bg-brand-canvas"
                              >
                                <td className="px-4 py-2 font-mono text-xs text-content">{b.sku ?? '—'}</td>
                                <td className="px-4 py-2 text-content">{b.productName ?? b.productId.slice(0, 8) + '…'}</td>
                                <td className="px-4 py-2 font-mono text-xs text-muted">{b.batchCode ?? '—'}</td>
                                <td className="px-4 py-2 tabular-nums text-muted">{b.expiryDate}</td>
                                <td className="px-4 py-2 tabular-nums text-content">{b.onHandQty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
            </Modal>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-brand-surface bg-table-head">
                <tr>
                  <th className="px-2 py-2 text-left">訂購（待收）</th>
                  <th className="px-2 py-2 text-right">實收</th>
                  <th className="px-2 py-2 text-right">合格</th>
                  <th className="px-2 py-2 text-right">退回</th>
                  <th className="px-2 py-2 text-left">退回原因</th>
                  <th className="px-2 py-2 text-left">批號</th>
                  <th className="px-2 py-2 text-left">效期日</th>
                  <th className="px-2 py-2 text-left">重量單位</th>
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
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        ln.batchCode ?? '—'
                      ) : (
                        <input
                          className="w-full min-w-[80px] rounded border px-2 py-1 text-xs"
                          value={ln.batchCode ?? ''}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, batchCode: e.target.value } : l,
                              ),
                            })
                          }
                          onBlur={() =>
                            saveLine(ln.id, {
                              batchCode: (detail.lines ?? []).find((l) => l.id === ln.id)?.batchCode ?? null,
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        ln.expiryDate ? ln.expiryDate.slice(0, 10) : '—'
                      ) : (
                        <input
                          type="date"
                          className="w-full rounded border px-2 py-1 text-xs"
                          value={ln.expiryDate ? ln.expiryDate.slice(0, 10) : ''}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, expiryDate: e.target.value || null } : l,
                              ),
                            })
                          }
                          onBlur={() =>
                            saveLine(ln.id, {
                              expiryDate: (detail.lines ?? []).find((l) => l.id === ln.id)?.expiryDate ?? null,
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {detail.status === 'COMPLETED' || detail.status === 'RETURNED' ? (
                        ln.weightUnit ?? '—'
                      ) : (
                        <select
                          className="w-full rounded border px-2 py-1 text-xs"
                          value={ln.weightUnit ?? ''}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              lines: (detail.lines ?? []).map((l) =>
                                l.id === ln.id ? { ...l, weightUnit: e.target.value || null } : l,
                              ),
                            })
                          }
                          onBlur={() =>
                            saveLine(ln.id, {
                              weightUnit: (detail.lines ?? []).find((l) => l.id === ln.id)?.weightUnit ?? null,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value="G">g</option>
                          <option value="KG">kg</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.status === 'COMPLETED' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                <div className="mb-2 text-sm font-semibold text-amber-900">退回供應商</div>
                <p className="mb-3 text-xs text-amber-800">
                  每列輸入欲退數量（不得超過合格數），送出後呼叫 POST /receiving-notes/:id/return-to-supplier。
                </p>
                {(() => {
                  const poLineCost = new Map((detailPo?.lines ?? []).map((l) => [l.id, Number(l.unitCost) || 0]));
                  const picked = (detail.lines ?? [])
                    .filter((ln) => (returnQty[ln.id] ?? 0) > 0)
                    .map((ln) => ({
                      id: ln.id,
                      qty: returnQty[ln.id] ?? 0,
                      unitCost: poLineCost.get(ln.poLineId) ?? 0,
                    }));
                  const totalQty = picked.reduce((s, x) => s + x.qty, 0);
                  const totalAmount = picked.reduce((s, x) => s + x.qty * x.unitCost, 0);
                  return (
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-900">
                      <span className="font-semibold">摘要</span>
                      <span>退回總件數：{totalQty}</span>
                      <span>估算金額：{Math.round(totalAmount * 100) / 100}</span>
                      <span className="text-amber-800">
                        影響：寫入庫存事件 <span className="font-mono">RETURN_TO_SUPPLIER</span>；寫入金流事件{' '}
                        <span className="font-mono">PURCHASE_RETURN</span>（以採購單 unitCost 計算）。
                      </span>
                      {!detailPo ? <span className="text-amber-700">（採購單成本載入中或不可用，金額可能為 0）</span> : null}
                    </div>
                  );
                })()}
                <div className="mb-3 space-y-2">
                  {(detail.lines ?? []).map((ln) => (
                    <div key={ln.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="w-32 truncate font-mono text-muted">列 {ln.id.slice(0, 8)}</label>
                      <span className="text-muted">合格 {ln.qualifiedQty}</span>
                      <input
                        type="number"
                        min={0}
                        max={ln.qualifiedQty}
                        className="w-20 rounded border border-amber-300 px-2 py-1 text-right"
                        value={returnQty[ln.id] ?? 0}
                        onChange={(e) =>
                          setReturnQty((prev) => ({ ...prev, [ln.id]: Math.max(0, Math.min(ln.qualifiedQty, Number(e.target.value) || 0)) }))
                        }
                      />
                      <span className="text-muted">件</span>
                      <input
                        className="h-8 min-w-[180px] flex-1 rounded border border-amber-300 px-2 text-xs"
                        placeholder="原因（例：瑕疵/規格不符/效期問題…）"
                        value={returnReason[ln.id] ?? ''}
                        onChange={(e) => setReturnReason((prev) => ({ ...prev, [ln.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-amber-300 text-amber-900 hover:bg-amber-100"
                  disabled={returnSubmitting || !(detail.lines ?? []).some((ln) => (returnQty[ln.id] ?? 0) > 0)}
                  onClick={async () => {
                    const lines = (detail.lines ?? [])
                      .filter((ln) => (returnQty[ln.id] ?? 0) > 0)
                      .map((ln) => ({ receivingNoteLineId: ln.id, quantity: returnQty[ln.id] ?? 0 }));
                    if (!lines.length) return;
                    setReturnLastSubmitted(
                      (detail.lines ?? [])
                        .filter((ln) => (returnQty[ln.id] ?? 0) > 0)
                        .map((ln) => ({
                          lineId: ln.id,
                          qty: returnQty[ln.id] ?? 0,
                          reason: (returnReason[ln.id] ?? '').trim(),
                        })),
                    );
                    setReturnSubmitting(true);
                    const out = await returnToSupplier(detail.id, { lines });
                    setReturnSubmitting(false);
                    if ('statusCode' in out) {
                      showToast(out.message, 'err');
                      return;
                    }
                    showToast('已送出退回供應商', 'ok');
                    setReturnQty({});
                    setReturnReason({});
                    setDetail(out);
                    load();
                  }}
                >
                  {returnSubmitting ? '送出中…' : '送出退回供應商'}
                </Button>
                {returnLastSubmitted && returnLastSubmitted.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-3 text-xs text-amber-900">
                    <div className="mb-2 font-semibold">本次送出明細</div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-[11px]">
                        <thead className="border-b border-amber-200 text-amber-800">
                          <tr>
                            <th className="px-2 py-1">列</th>
                            <th className="px-2 py-1 text-right">數量</th>
                            <th className="px-2 py-1">原因（前端備註）</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnLastSubmitted.map((x) => (
                            <tr key={x.lineId} className="border-t border-amber-100">
                              <td className="px-2 py-1 font-mono text-amber-900">{x.lineId.slice(0, 8)}</td>
                              <td className="px-2 py-1 text-right font-mono text-amber-900">{x.qty}</td>
                              <td className="px-2 py-1 text-amber-900">{x.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-[11px] text-amber-800">原因為前端備註展示。</div>
                  </div>
                ) : null}
                {detail.purchaseOrderId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="ml-2"
                    onClick={() => {
                      setDetail(null);
                      navigate(`/admin/purchase-orders?id=${encodeURIComponent(detail.purchaseOrderId)}`);
                    }}
                  >
                    前往採購單
                  </Button>
                )}
              </div>
            )}
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
                  className="text-brand-danger"
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
        ) : null}
      </Modal>
    </>
  );
};
