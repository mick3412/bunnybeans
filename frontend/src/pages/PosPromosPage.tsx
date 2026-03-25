import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StandardListLayout } from '../shared/components/StandardListLayout';
import { getStores } from '../modules/pos/posOrdersApi';
import { listPromotionRules, listProductTags, type PromotionRuleDto, type ApiError, type ProductTagDto } from '../modules/admin/adminApi';
import { getErrorMessage } from '../shared/errors/errorMessages';
import { formatAutoConditionDetail } from '../shared/utils/productTagDisplay';

export const PosPromosPage: React.FC = () => {
  const [merchantId, setMerchantId] = useState<string>('');
  const [rows, setRows] = useState<PromotionRuleDto[]>([]);
  const [discountTags, setDiscountTags] = useState<ProductTagDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const stores = await getStores();
      if (cancelled) return;
      if (!Array.isArray(stores) || stores.length === 0) {
        setErr(typeof stores === 'object' && stores && 'message' in stores ? (stores as ApiError).message : '無法載入門市');
        setRows([]);
        setLoading(false);
        return;
      }
      const withWh = stores.find((s) => (s.warehouseIds?.length ?? 0) > 0) ?? stores[0];
      const mid = withWh.merchantId ?? stores[0].merchantId ?? '';
      if (!mid) {
        setErr('門市未帶 merchantId，無法載入促銷規則');
        setRows([]);
        setLoading(false);
        return;
      }
      setMerchantId(mid);
      const [res, tagsRes] = await Promise.all([
        listPromotionRules({ merchantId: mid, status: 'active' }),
        listProductTags(mid),
      ]);
      if (cancelled) return;
      if ('statusCode' in res) {
        setErr(getErrorMessage(res as ApiError));
        setRows([]);
      } else {
        setErr(null);
        setRows(res);
      }
      if (Array.isArray(tagsRes)) {
        setDiscountTags(tagsRes.filter((t) => t.showInPosDiscount !== false));
      } else {
        setDiscountTags([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StandardListLayout
      title="進行中促銷"
      description={
        <>
          <p className="text-sm text-muted">
            與收銀門市同源 <span className="font-mono text-xs">merchantId</span>，僅列出狀態為進行中之規則（唯讀）。
          </p>
          <p className="mt-1 text-sm">
            <Link to="/admin/promotions" className="font-medium text-brand-primary hover:underline">
              後台編輯促銷規則
            </Link>
          </p>
          <p className="mt-1 text-sm">
            <Link to="/admin/discount-tags" className="font-medium text-brand-primary hover:underline">
              後台編輯折扣標籤
            </Link>
          </p>
        </>
      }
      loading={loading}
      error={err ?? undefined}
      empty={!loading && !err && rows.length === 0}
      emptyMessage="目前無進行中之促銷規則"
      testId="e2e-pos-promos"
    >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 max-w-2xl">
            <ul className="space-y-3">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-brand-surface bg-table-head px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-content">{p.name}</div>
                      <div className="mt-0.5 text-xs text-muted">{p.summary || '—'}</div>
                      <div className="mt-1 text-xs text-muted">
                        優先序 {p.priority}
                        {p.firstPurchaseOnly ? ' · 首購' : ''}
                        {p.exclusive ? ' · 互斥' : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      進行中
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="shrink-0 rounded-xl border border-brand-surface bg-table-head px-4 py-3 shadow-sm lg:min-w-[260px]"
            data-testid="e2e-pos-promos-discount-tags"
          >
            <h3 className="text-sm font-semibold text-content">折扣標籤</h3>
            <p className="mt-0.5 text-xs text-muted">收銀區「折扣」篩選列顯示的標籤</p>
            {discountTags.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {discountTags.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col items-start rounded-lg border border-brand-surface bg-white px-2.5 py-1.5 text-left"
                  >
                    <span className="font-medium text-content">{t.name}</span>
                    <span className="mt-0.5 text-[11px] text-muted">
                      {formatAutoConditionDetail(t.autoCondition)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">尚無標籤</p>
            )}
          </div>
        </div>
    </StandardListLayout>
  );
};
