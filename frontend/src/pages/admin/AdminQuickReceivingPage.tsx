import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../shared/components/Alert';
import { Button } from '../../shared/components/Button';
import { EmptyState } from '../../shared/components/EmptyState';
import { TextInput } from '../../shared/components/TextInput';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';
import { getProducts, getWarehouses, type ProductFullDto, type WarehouseDto } from '../../modules/admin/adminApi';
import { createPurchaseOrder, listSuppliers, type ApiError as PurchaseApiError } from '../../modules/admin/purchaseApi';
import type { ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

type LineDraft = { productId: string; qty: number; unitCost: number };

export const AdminQuickReceivingPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const { showToast } = useAdminToast();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [products, setProducts] = useState<ProductFullDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [remark, setRemark] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ productId: '', qty: 1, unitCost: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    const [wh, pr] = await Promise.all([getWarehouses(), getProducts()]);
    setLoading(false);
    const whArr = Array.isArray(wh) ? wh : [];
    const prArr = Array.isArray(pr) ? pr : [];
    if (!Array.isArray(wh)) setLoadErr(getErrorMessage(wh as ApiError) || '載入倉庫失敗');
    else if (!Array.isArray(pr)) setLoadErr(getErrorMessage(pr as ApiError) || '載入商品失敗');
    else setLoadErr(null);
    setWarehouses(whArr);
    setProducts(prArr);
    if (whArr[0]) setWarehouseId((prev) => (prev ? prev : whArr[0].id));
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!merchantId) return;
    let cancelled = false;
    (async () => {
      const sups = await listSuppliers(merchantId);
      if (cancelled) return;
      if (sups.error) {
        showToast(sups.error.message, 'err');
        setSuppliers([]);
      } else {
        setSuppliers(sups.data.map((s) => ({ id: s.id, name: s.name })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId, showToast]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: `${p.sku ? `${p.sku} · ` : ''}${p.name}`,
      })),
    [products],
  );

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0), [lines]);

  const submit = async () => {
    if (!merchantId) {
      showToast('缺少 merchantId', 'err');
      return;
    }
    if (!supplierId) {
      showToast('缺少供應商', 'err');
      return;
    }
    if (!warehouseId) {
      showToast('缺少倉庫/門市', 'err');
      return;
    }
    const validLines = lines
      .map((l) => ({ ...l, qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 }))
      .filter((l) => l.productId && l.qty > 0);
    if (!validLines.length) {
      showToast('至少需要一列品項且數量 > 0', 'err');
      return;
    }

    if (remark.trim()) {
      showToast('備註未寫入採購單', 'err');
    }

    setSubmitting(true);
    const orderNumber = `PO-${Date.now().toString().slice(-8)}`;
    const out = await createPurchaseOrder({
      merchantId,
      supplierId,
      warehouseId,
      orderNumber,
      expectedDate: undefined,
      lines: validLines.map((l) => ({ productId: l.productId, qtyOrdered: l.qty, unitCost: l.unitCost })),
    });
    setSubmitting(false);

    if ('statusCode' in out) {
      showToast((out as PurchaseApiError).message ?? '建立採購單失敗', 'err');
      return;
    }

    showToast('已建立採購單', 'ok');
    navigate(`/admin/purchase-orders?id=${encodeURIComponent(out.id)}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="e2e-admin-quick-receiving">
      <div className="rounded-2xl border border-brand-surface bg-white p-6 shadow-sm">
        <div className="mb-4 border-b border-brand-surface pb-2">
          <h2 className="text-lg font-semibold text-content">快速進貨</h2>
          <p className="mt-1 text-sm text-muted" aria-hidden="true" />
        </div>

        {loadErr && (
          <Alert variant="error" className="mb-4 flex items-center justify-between gap-3">
            <span>{loadErr}</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadData()}>
              重試
            </Button>
          </Alert>
        )}
        {loading && (
          <div className="mb-4 rounded-lg border border-brand-surface bg-table-head px-3 py-3 text-sm text-muted">載入資料中…</div>
        )}
        {!loading && !loadErr && (products.length === 0 || warehouses.length === 0) && (
          <div className="mb-4">
            <EmptyState
              message={products.length === 0 && warehouses.length === 0 ? '尚無倉庫或商品' : products.length === 0 ? '尚無商品' : '尚無倉庫'}
              description="請先建立商品主檔與倉庫"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-content">供應商</label>
            <select
              className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">選擇供應商</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-content">倉庫/門市</label>
            <select
              className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">選擇倉庫/門市</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <TextInput label="備註（選填）" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="" />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-brand-surface">
          <div className="border-b border-brand-surface bg-table-head px-4 py-3 text-sm font-semibold text-content">品項</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-white text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">商品</th>
                  <th className="px-4 py-3 text-right">數量</th>
                  <th className="px-4 py-3 text-right">單價</th>
                  <th className="w-14 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx} className="border-b border-brand-surface">
                    <td className="px-4 py-2.5">
                      <select
                        className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        value={l.productId}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))
                        }
                      >
                        <option value="">選擇商品</option>
                        {productOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={1}
                        className="h-9 w-24 rounded-lg border border-brand-surface bg-white px-2 py-1 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        value={String(l.qty)}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        className="h-9 w-28 rounded-lg border border-brand-surface bg-white px-2 py-1 text-sm text-right tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        value={String(l.unitCost)}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, unitCost: Number(e.target.value) } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        className="rounded-md border border-brand-surface bg-white px-2 py-1 text-xs text-muted hover:border-brand-primary/30 disabled:opacity-40"
                        disabled={lines.length <= 1}
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-surface bg-table-head px-4 py-3">
            <button
              type="button"
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm font-semibold text-content hover:border-brand-primary/30"
              onClick={() => setLines((prev) => [...prev, { productId: '', qty: 1, unitCost: 0 }])}
            >
              + 新增一列
            </button>
            <span className="ml-auto text-sm font-semibold tabular-nums text-content">預估總額：{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/purchase-orders')}>
            返回採購單
          </Button>
          <Button type="button" variant="primary" disabled={submitting} onClick={() => void submit()}>
            {submitting ? '建立中…' : '一鍵完成（建立採購單）'}
          </Button>
          <span className="text-xs text-muted">建立後可於採購單詳情點「建立驗收單」。</span>
        </div>
      </div>
    </div>
  );
};

