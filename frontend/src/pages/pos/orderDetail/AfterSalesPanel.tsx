import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import {
  previewReturn,
  executeReturn,
  getOrderById,
  getPosProducts,
  type PosProductWithStockDto,
  type ReturnReasonCode,
  type ItemConditionCode,
  type RefundMethodCode,
  type ReturnTypeCode,
  type ReturnPreviewResult,
  type ExchangeItemInput,
  type ApiError,
} from '../../../modules/pos/posOrdersApi';
import { getErrorMessage } from '../../../shared/errors/errorMessages';
import type { PosOrderDetail } from '../../../modules/pos/posOrdersMockService';

type AfterSalesMode = 'menu' | 'return';
const SHOW_LEGACY_AFTERSALES = false;

const RETURN_REASONS: { value: ReturnReasonCode; label: string }[] = [
  { value: 'SIZE_WRONG', label: '尺寸不合' },
  { value: 'DEFECTIVE', label: '瑕疵品' },
  { value: 'CHANGED_MIND', label: '改變心意' },
  { value: 'WRONG_ITEM', label: '拿錯商品' },
  { value: 'DUPLICATE_PURCHASE', label: '重複購買' },
  { value: 'OTHER', label: '其他' },
];

const ITEM_CONDITIONS: { value: ItemConditionCode; label: string }[] = [
  { value: 'GOOD', label: '良品入庫' },
  { value: 'DEFECTIVE_ITEM', label: '需報廢' },
];

interface LineState {
  checked: boolean;
  quantity: string;
  reason: ReturnReasonCode;
  condition: ItemConditionCode;
}

export const AfterSalesPanel: React.FC<{
  order: PosOrderDetail;
  tab: 'refund' | 'return' | 'exchange';
  setTab: (t: 'refund' | 'return' | 'exchange') => void;
  displayPaid: number;
  refundAmount: string;
  refundNote: string;
  refundSubmitting: boolean;
  refundError: string | null;
  onRefundAmount: (v: string) => void;
  onRefundNote: (v: string) => void;
  onRefundSubmit: () => void;
  returnQtyByLine: Record<string, string>;
  returnStockSubmitting: boolean;
  returnStockError: string | null;
  returnStockOk: string | null;
  onReturnQtyChange: (lineId: string, v: string) => void;
  onReturnSubmit: () => void;
  onGoPos: () => void;
  productMap?: Record<string, { id: string; name?: string; sku?: string }>;
  onOrderUpdate?: (order: PosOrderDetail) => void;
}> = ({
  order,
  tab,
  setTab,
  displayPaid,
  refundAmount,
  refundNote,
  refundSubmitting,
  refundError,
  onRefundAmount,
  onRefundNote,
  onRefundSubmit,
  returnQtyByLine,
  returnStockSubmitting,
  returnStockError,
  returnStockOk,
  onReturnQtyChange,
  onReturnSubmit,
  onGoPos,
  productMap,
  onOrderUpdate,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AfterSalesMode>('menu');
  const [returnType, setReturnType] = useState<ReturnTypeCode>('PARTIAL_RETURN');
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethodCode>('CASH');
  const [preview, setPreview] = useState<ReturnPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemInput[]>([]);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangeCatalog, setExchangeCatalog] = useState<PosProductWithStockDto[]>([]);
  const [exchangeSearchResults, setExchangeSearchResults] = useState<PosProductWithStockDto[]>([]);
  const [exchangeSearching, setExchangeSearching] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  const initLines = useCallback(() => {
    const states: Record<string, LineState> = {};
    for (const line of order.items) {
      states[line.id] = {
        checked: returnType === 'FULL_RETURN',
        quantity: returnType === 'FULL_RETURN' ? String(line.quantity) : '',
        reason: 'CHANGED_MIND',
        condition: 'GOOD',
      };
    }
    setLineStates(states);
    setPreview(null);
    setReturnError(null);
    setReturnSuccess(null);
  }, [order.items, returnType]);

  useEffect(() => {
    if (mode === 'return') initLines();
  }, [mode, returnType, initLines]);

  useEffect(() => {
    if (returnType !== 'EXCHANGE' || mode !== 'return') return;
    let cancelled = false;
    const loadCatalog = async () => {
      const res = await getPosProducts(order.storeId);
      if (!cancelled && Array.isArray(res)) {
        setExchangeCatalog(res);
      }
    };
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [returnType, mode, order.storeId]);

  useEffect(() => {
    const term = exchangeSearch.trim();
    if (term.length < 1) {
      setExchangeSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setExchangeSearching(true);
      const q = term.toLowerCase();
      const filtered = exchangeCatalog
        .filter((p) =>
          p.id.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q),
        )
        .slice(0, 10);
      setExchangeSearchResults(filtered);
      setExchangeSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [exchangeSearch, exchangeCatalog]);

  const addExchangeProduct = useCallback(
    (product: PosProductWithStockDto) => {
      setExchangeItems((prev) => {
        const existing = prev.find((e) => e.productId === product.id);
        if (existing) {
          return prev.map((e) =>
            e.productId === product.id ? { ...e, quantity: e.quantity + 1 } : e,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            quantity: 1,
            unitPrice: Number(product.salePrice ?? 0),
          },
        ];
      });
      setExchangeSearch('');
      setExchangeSearchResults([]);
      setPreview(null);
    },
    [],
  );

  const selectedItems = useMemo(() => {
    return order.items
      .filter((line) => lineStates[line.id]?.checked)
      .map((line) => {
        const st = lineStates[line.id];
        return {
          productId: line.productId,
          quantity: Math.max(1, parseInt(st?.quantity || '0', 10) || 0),
          reason: st?.reason ?? 'CHANGED_MIND',
          condition: st?.condition ?? 'GOOD',
        };
      })
      .filter((i) => i.quantity > 0);
  }, [order.items, lineStates]);

  const handlePreview = useCallback(async () => {
    if (selectedItems.length === 0) {
      setReturnError('請至少勾選一項退貨商品');
      return;
    }
    setPreviewLoading(true);
    setReturnError(null);
    const res = await previewReturn(order.id, {
      type: returnType,
      items: selectedItems,
      refundMethod,
      exchangeItems: returnType === 'EXCHANGE' ? exchangeItems : undefined,
    });
    setPreviewLoading(false);
    if ('statusCode' in res) {
      setReturnError(getErrorMessage(res as ApiError));
      setPreview(null);
    } else {
      setPreview(res);
      if (!res.eligible) {
        setReturnError('已超過退換貨期限');
      }
    }
  }, [order.id, returnType, selectedItems, refundMethod, exchangeItems]);

  const handleSubmit = useCallback(async () => {
    if (selectedItems.length === 0) return;
    setSubmitLoading(true);
    setReturnError(null);
    const res = await executeReturn(order.id, {
      type: returnType,
      items: selectedItems,
      refundMethod,
      exchangeItems: returnType === 'EXCHANGE' ? exchangeItems : undefined,
      exchangePayments:
        returnType === 'EXCHANGE' && preview && preview.deltaAmount > 0
          ? [{ method: 'CASH', amount: preview.deltaAmount }]
          : undefined,
      note: returnNote.trim() || undefined,
    });
    setSubmitLoading(false);
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body) {
      setReturnSuccess(
        returnType === 'EXCHANGE'
          ? `換貨完成（退貨單 ${res.body.returnNumber}）`
          : `退貨完成（退貨單 ${res.body.returnNumber}，退款 $${res.body.refundAmount}）`,
      );
      setMode('menu');
      if (onOrderUpdate) {
        const reloaded = await getOrderById(order.id);
        if ('items' in reloaded && Array.isArray((reloaded as PosOrderDetail).items)) {
          onOrderUpdate(reloaded as PosOrderDetail);
        }
      }
    } else {
      setReturnError(getErrorMessage({ code: res.code, message: res.message }));
    }
  }, [order.id, returnType, selectedItems, refundMethod, exchangeItems, preview, returnNote]);

  const updateLine = (lineId: string, patch: Partial<LineState>) => {
    setLineStates((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], ...patch },
    }));
    setPreview(null);
  };

  const productName = (productId: string) => {
    const fromMap = productMap?.[productId]?.name;
    if (fromMap) return fromMap;
    const fromCatalog = exchangeCatalog.find((p) => p.id === productId)?.name;
    return fromCatalog ?? productId.slice(0, 8);
  };

  const startReturn = (type: ReturnTypeCode) => {
    setReturnType(type);
    setMode('return');
    setExchangeItems([]);
    setReturnNote('');
    setReturnSuccess(null);
  };

  if (mode === 'return') {
    return (
      <div className="rounded-lg border border-brand-surface bg-white px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase text-muted">
            {returnType === 'FULL_RETURN'
              ? '全單退貨'
              : returnType === 'EXCHANGE'
                ? '換貨'
                : '部分退貨'}
          </div>
          <button
            type="button"
            className="text-[11px] text-brand-primary hover:underline"
            onClick={() => setMode('menu')}
          >
            返回
          </button>
        </div>

        {/* Step 1: Item selector */}
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-medium text-muted">勾選退貨品項</div>
          {order.items.map((line) => {
            const st = lineStates[line.id] ?? {
              checked: false,
              quantity: '',
              reason: 'CHANGED_MIND' as ReturnReasonCode,
              condition: 'GOOD' as ItemConditionCode,
            };
            return (
              <div
                key={line.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${
                  st.checked
                    ? 'border-brand-primary/40 bg-brand-primary/5'
                    : 'border-brand-surface'
                }`}
              >
                <input
                  type="checkbox"
                  checked={st.checked}
                  disabled={returnType === 'FULL_RETURN'}
                  onChange={(e) =>
                    updateLine(line.id, {
                      checked: e.target.checked,
                      quantity: e.target.checked ? String(line.quantity) : '',
                    })
                  }
                  className="h-3.5 w-3.5 accent-brand-primary"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-content">
                  {productName(line.productId)}
                </span>
                <span className="text-muted">售 {line.quantity}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="退"
                  className="h-6 w-12 rounded border border-brand-surface bg-white px-1 text-right tabular-nums text-[11px]"
                  value={st.quantity}
                  disabled={!st.checked || returnType === 'FULL_RETURN'}
                  onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                />
                {st.checked && (
                  <>
                    <select
                      value={st.reason}
                      onChange={(e) =>
                        updateLine(line.id, { reason: e.target.value as ReturnReasonCode })
                      }
                      className="h-6 rounded border border-brand-surface bg-white px-1 text-[10px]"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={st.condition}
                      onChange={(e) =>
                        updateLine(line.id, {
                          condition: e.target.value as ItemConditionCode,
                        })
                      }
                      className="h-6 rounded border border-brand-surface bg-white px-1 text-[10px]"
                    >
                      {ITEM_CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Exchange: add new items */}
        {returnType === 'EXCHANGE' && (
          <div className="mt-3 rounded-lg border border-brand-surface bg-table-head px-3 py-2">
            <div className="mb-1 text-[10px] font-medium text-content">換入商品</div>
            {exchangeItems.map((ei, idx) => (
              <div
                key={idx}
                className="mb-1 flex items-center gap-2 text-[11px]"
              >
                <span className="flex-1 truncate">
                  {productName(ei.productId)}
                </span>
                <span>×{ei.quantity}</span>
                <span className="tabular-nums">${ei.unitPrice}</span>
                <button
                  type="button"
                  className="text-brand-danger hover:underline"
                  onClick={() => {
                    setExchangeItems((prev) => prev.filter((_, i) => i !== idx));
                    setPreview(null);
                  }}
                >
                  移除
                </button>
              </div>
            ))}
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="搜尋商品名稱、SKU 或掃碼"
                className="h-7 w-full rounded border border-brand-surface bg-white px-2 text-[11px]"
                value={exchangeSearch}
                onChange={(e) => setExchangeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && exchangeSearchResults.length > 0) {
                    addExchangeProduct(exchangeSearchResults[0]);
                  }
                }}
              />
              {exchangeSearching && (
                <div className="absolute right-2 top-1.5 text-[10px] text-muted">搜尋中…</div>
              )}
              {exchangeSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded-lg border border-brand-surface bg-white shadow-lg">
                  {exchangeSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-brand-surface/50"
                      onClick={() => addExchangeProduct(p)}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-muted">{p.sku}</span>
                      <span className="shrink-0 tabular-nums">${p.salePrice ?? 0}</span>
                    </button>
                  ))}
                </div>
              )}
              {!exchangeSearching &&
                exchangeSearch.trim().length > 0 &&
                exchangeSearchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-0.5 rounded-lg border border-brand-surface bg-white px-2 py-2 text-[11px] text-muted shadow-lg">
                    查無符合商品，請改用其他關鍵字（商品名稱 / SKU / 商品編號）
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Preview button */}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={previewLoading || selectedItems.length === 0}
            onClick={() => void handlePreview()}
          >
            {previewLoading ? '計算中…' : '試算退款'}
          </Button>
        </div>

        {/* Step 2: Calculation panel */}
        {preview && (
          <div className="mt-3 rounded-lg border-2 border-brand-danger/30 bg-brand-danger/5 px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-brand-danger">
              退款試算
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">退回品項原價小計</span>
                <span className="tabular-nums">${preview.returnSubtotal}</span>
              </div>
              {preview.discountShare > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">折扣分攤</span>
                  <span className="tabular-nums text-brand-primary">
                    -${preview.discountShare}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-brand-surface pt-1 font-semibold">
                <span>應退金額</span>
                <span className="tabular-nums text-brand-danger text-sm">
                  ${preview.refundAmount}
                </span>
              </div>
              {preview.pointsToDeduct > 0 && (
                <div className="flex justify-between text-muted">
                  <span>扣回贈點</span>
                  <span>-{preview.pointsToDeduct} 點</span>
                </div>
              )}
              {preview.pointsToReturn > 0 && (
                <div className="flex justify-between text-muted">
                  <span>退還折抵點數</span>
                  <span className="text-brand-success">
                    +{preview.pointsToReturn} 點
                  </span>
                </div>
              )}
              {returnType === 'EXCHANGE' && (
                <>
                  <div className="flex justify-between border-t border-brand-surface pt-1">
                    <span className="text-muted">換入品項合計</span>
                    <span className="tabular-nums">${preview.exchangeTotal}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>差額</span>
                    <span
                      className={`tabular-nums ${
                        preview.deltaAmount > 0
                          ? 'text-brand-danger'
                          : preview.deltaAmount < 0
                            ? 'text-brand-success'
                            : ''
                      }`}
                    >
                      {preview.deltaAmount > 0
                        ? `$${preview.deltaAmount} 顧客需補繳`
                        : preview.deltaAmount < 0
                          ? `$${Math.abs(preview.deltaAmount)} 退還顧客`
                          : '$0 等價交換'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {preview && preview.eligible && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-muted">退款方式</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="refundMethod"
                  value="CASH"
                  checked={refundMethod === 'CASH'}
                  onChange={() => setRefundMethod('CASH')}
                  className="accent-brand-primary"
                />
                退現金
              </label>
              {order.customerId && (
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="refundMethod"
                    value="STORE_CREDIT"
                    checked={refundMethod === 'STORE_CREDIT'}
                    onChange={() => setRefundMethod('STORE_CREDIT')}
                    className="accent-brand-primary"
                  />
                  轉購物金
                </label>
              )}
            </div>
            <input
              type="text"
              placeholder="備註（選填）"
              className="h-7 w-full rounded border border-brand-surface bg-white px-2 text-[11px]"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={submitLoading}
              onClick={() => void handleSubmit()}
            >
              {submitLoading
                ? '處理中…'
                : returnType === 'EXCHANGE'
                  ? '確認換貨'
                  : '確認退貨'}
            </Button>
          </div>
        )}

        {returnError && (
          <p className="mt-2 text-[11px] text-brand-danger">{returnError}</p>
        )}
      </div>
    );
  }

  return (
  <div className="rounded-lg border border-brand-surface bg-white px-3 py-2 sm:px-4">
    <div className="text-[10px] font-semibold uppercase text-muted">退換貨操作</div>

      {returnSuccess && (
        <div className="mt-2 rounded bg-brand-success/10 px-2 py-1.5 text-[11px] text-brand-success">
          {returnSuccess}
        </div>
      )}

      {SHOW_LEGACY_AFTERSALES ? (
    <div className="mt-2 flex flex-wrap gap-1">
      {([
        ['refund', '退款'],
        ['exchange', '換貨'],
      ] as const).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setTab(k)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                tab === k
                  ? 'bg-brand-primary text-white'
                  : 'bg-table-head text-content hover:bg-brand-surface'
          }`}
        >
          {label}
        </button>
      ))}
        </div>
      ) : null}

      {/* New unified return buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => startReturn('FULL_RETURN')}
        >
          全單退貨
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => startReturn('PARTIAL_RETURN')}
        >
          部分退貨
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => startReturn('EXCHANGE')}
        >
          換貨
        </Button>
    </div>

      {SHOW_LEGACY_AFTERSALES && tab === 'refund' ? (
        <div
          id="refund"
          className="mt-3 rounded-lg border border-brand-surface bg-table-head px-3 py-2"
        >
          <div className="mb-1 text-[11px] font-semibold text-content">
            退款（沖帳）
          </div>
          <p className="mb-2 text-[10px] text-muted">
            已實收範圍內登記退款，不超過實收合計；全賒未收單不可退。
          </p>
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="退款金額"
            data-testid="e2e-detail-refund-amount"
            className="h-8 w-24 rounded border border-brand-surface bg-white px-2 text-right tabular-nums"
            value={refundAmount}
            onChange={(e) => onRefundAmount(e.target.value)}
            disabled={displayPaid < 0.01}
          />
          <input
            type="text"
            placeholder="備註（選填）"
            className="h-8 min-w-[120px] flex-1 rounded border border-brand-surface bg-white px-2 text-[11px]"
            value={refundNote}
            onChange={(e) => onRefundNote(e.target.value)}
            disabled={displayPaid < 0.01}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refundSubmitting || displayPaid < 0.01}
            data-testid="e2e-detail-refund-submit"
            onClick={onRefundSubmit}
          >
            {refundSubmitting ? '送出…' : '確認退款'}
          </Button>
        </div>
          {refundError ? (
            <p className="mt-1 text-[11px] text-brand-danger">{refundError}</p>
          ) : null}
      </div>
    ) : null}

      {SHOW_LEGACY_AFTERSALES && tab === 'exchange' ? (
        <div className="mt-3 rounded-lg border border-brand-surface bg-table-head px-3 py-2 text-[11px] text-muted">
          <div className="font-medium text-content">換貨流程</div>
          <p className="mt-1">
            建議使用上方「換貨」按鈕，系統會自動處理退貨入庫、建新單、差額計算與點數回扣。
          </p>
          <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
              onClick={() => startReturn('EXCHANGE')}
          >
              開始換貨
          </Button>
          </div>
      </div>
    ) : null}

      <AfterSalesHistory
        order={order}
        productName={productName}
        navigate={navigate}
      />
    </div>
  );
};

const RETURN_TYPE_LABEL: Record<string, { text: string; color: string }> = {
  FULL_RETURN: { text: '全單退貨', color: 'text-brand-danger' },
  PARTIAL_RETURN: { text: '部分退貨', color: 'text-brand-danger' },
  EXCHANGE: { text: '換貨', color: 'text-amber-600' },
};

const REASON_LABEL: Record<string, string> = {
  SIZE_WRONG: '尺寸不合',
  DEFECTIVE: '瑕疵品',
  CHANGED_MIND: '改變心意',
  WRONG_ITEM: '拿錯商品',
  DUPLICATE_PURCHASE: '重複購買',
  OTHER: '其他',
};

const CONDITION_LABEL: Record<string, string> = {
  GOOD: '良品',
  DEFECTIVE_ITEM: '報廢',
};

const REFUND_METHOD_LABEL: Record<string, string> = {
  CASH: '現金',
  STORE_CREDIT: '購物金',
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const AfterSalesHistory: React.FC<{
  order: PosOrderDetail;
  productName: (pid: string) => string;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ order, productName, navigate }) => {
  type TimelineEntry =
    | { kind: 'refund'; time: string; data: NonNullable<PosOrderDetail['refundRecords']>[number] }
    | { kind: 'return'; time: string; data: NonNullable<PosOrderDetail['returnRecords']>[number] };

  const entries = useMemo(() => {
    const list: TimelineEntry[] = [];
    for (const r of order.refundRecords ?? []) {
      list.push({ kind: 'refund', time: r.occurredAt, data: r });
    }
    for (const r of order.returnRecords ?? []) {
      list.push({ kind: 'return', time: r.createdAt, data: r });
    }
    list.sort((a, b) => (a.time > b.time ? -1 : a.time < b.time ? 1 : 0));
    return list;
  }, [order.refundRecords, order.returnRecords]);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-brand-surface bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">退換貨歷程</div>
      <div className="mt-2 space-y-2.5">
        {entries.map((entry) => {
          if (entry.kind === 'refund') {
            const r = entry.data;
            return (
              <div key={`rf-${r.id}`} className="flex gap-2 text-[11px]">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-brand-primary">退款</span>
                    <span className="tabular-nums font-semibold">${r.amount}</span>
                  </div>
                  <div className="text-[10px] text-muted">
                    {fmtTime(r.occurredAt)}
                    {r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
              </div>
            );
          }

          const r = entry.data;
          const typeInfo = RETURN_TYPE_LABEL[r.type] ?? { text: r.type, color: 'text-content' };
          return (
            <div key={`rt-${r.id}`} className="flex gap-2 text-[11px]">
              <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${r.type === 'EXCHANGE' ? 'bg-amber-500' : 'bg-brand-danger'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`font-semibold ${typeInfo.color}`}>{typeInfo.text}</span>
                  <span className="text-[10px] text-muted">{r.returnNumber}</span>
                </div>
                <div className="text-[10px] text-muted">
                  {fmtTime(r.createdAt)} · 退款 ${r.refundAmount} ({REFUND_METHOD_LABEL[r.refundMethod] ?? r.refundMethod})
                  {r.pointsDeducted > 0 ? ` · 扣點 -${r.pointsDeducted}` : ''}
                  {r.pointsReturned > 0 ? ` · 還點 +${r.pointsReturned}` : ''}
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  {r.items.map((item, idx) => (
                    <span key={idx}>
                      {idx > 0 ? '、' : ''}
                      {productName(item.productId)} x{item.quantity}
                      <span className="text-muted/70">
                        ({REASON_LABEL[item.reason] ?? item.reason}/{CONDITION_LABEL[item.condition] ?? item.condition})
                      </span>
                    </span>
                  ))}
                </div>
                {r.exchangeOrderId && (
                  <button
                    type="button"
                    className="mt-0.5 text-[10px] text-brand-primary hover:underline"
                    onClick={() => navigate(`/pos/orders/${encodeURIComponent(r.exchangeOrderId!)}`)}
                  >
                    查看換貨新單
                  </button>
                )}
                {r.note && (
                  <div className="mt-0.5 text-[10px] text-muted/70">備註：{r.note}</div>
                )}
              </div>
        </div>
          );
        })}
      </div>
  </div>
);
};
