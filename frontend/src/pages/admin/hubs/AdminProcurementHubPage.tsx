import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { getSupplierRankings, type SupplierRankingItem, type ApiError } from '../../../modules/admin/purchaseApi';
import { AdminPurchaseOrdersPage } from '../AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from '../AdminReceivingNotesPage';
import { AdminReplenishmentPage } from '../AdminReplenishmentPage';
import { formatMoney } from '../../../shared/utils/formatMoney';

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type ProcurementHubTabKey = 'purchaseOrders' | 'receivingNotes' | 'replenishment';

const TAB_OPTIONS: Array<{ key: ProcurementHubTabKey; label: string }> = [
  { key: 'purchaseOrders', label: '採購單' },
  { key: 'receivingNotes', label: '進貨驗收／退供' },
  { key: 'replenishment', label: '補貨建議' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active
      ? '!bg-forge-sidebar !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}

export function AdminProcurementHubPage(props: { initialTab?: ProcurementHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const merchantId = useDefaultMerchantId();
  const [hubParams, setHubParams] = useScopedSearchParams('procurement.hub');
  const [supplierRankings, setSupplierRankings] = useState<SupplierRankingItem[]>([]);
  const [rankingsErr, setRankingsErr] = useState<string | null>(null);

  const loadRankings = useCallback(async () => {
    if (!merchantId) return;
    setRankingsErr(null);
    const t = new Date();
    const to = toYmd(t);
    t.setDate(t.getDate() - 30);
    const from = toYmd(t);
    const out = await getSupplierRankings({ merchantId, from, to });
    if ('statusCode' in out) {
      setRankingsErr((out as ApiError).message ?? '載入失敗');
      setSupplierRankings([]);
    } else {
      setSupplierRankings(out.items ?? []);
    }
  }, [merchantId]);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings]);

  const tabFromUrl = (hubParams.get('tab') as ProcurementHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<ProcurementHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/purchase-orders') return 'purchaseOrders';
    if (p === '/admin/receiving-notes') return 'receivingNotes';
    if (p === '/admin/replenishment') return 'replenishment';
    if (p === '/admin/procurement') return null;
    return null;
  }, [location.pathname]);

  const defaultTab: ProcurementHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'purchaseOrders';
  const [activeTab, setActiveTab] = useState<ProcurementHubTabKey>(defaultTab);

  const toPath = useMemo<Record<ProcurementHubTabKey, string>>(
    () => ({
      purchaseOrders: '/admin/purchase-orders',
      receivingNotes: '/admin/receiving-notes',
      replenishment: '/admin/replenishment',
    }),
    [],
  );

  useEffect(() => {
    if (!tabFromUrl) return;
    if (tabFromUrl === activeTab) return;
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (!tabFromPathname) return;
    if (tabFromPathname === activeTab) return;
    setActiveTab(tabFromPathname);
  }, [tabFromPathname, activeTab]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setHubParams(next, { replace: true });
  }, [activeTab, setHubParams]);

  const ActivePage = useMemo(() => {
    if (activeTab === 'receivingNotes') return AdminReceivingNotesPage;
    if (activeTab === 'replenishment') return AdminReplenishmentPage;
    return AdminPurchaseOrdersPage;
  }, [activeTab]);

  return (
    <div className="space-y-4">
      {merchantId && (
        <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-content">供應商採購排行（近 30 日）</h3>
          {rankingsErr ? (
            <p className="text-sm text-red-600">{rankingsErr}</p>
          ) : supplierRankings.length === 0 ? (
            <p className="text-sm text-muted">尚無驗收完成資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="border-b border-brand-surface text-muted">
                  <tr>
                    <th className="px-3 py-1.5">供應商</th>
                    <th className="px-3 py-1.5 text-right">驗收筆數</th>
                    <th className="px-3 py-1.5 text-right">採購金額</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierRankings.slice(0, 10).map((r) => (
                    <tr key={r.supplierId} className="border-t border-brand-surface">
                      <td className="px-3 py-1.5 font-medium">{r.supplierName ?? r.supplierCode}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.receivingNotesCount}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatMoney(r.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-surface pb-3">
        {TAB_OPTIONS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant="secondary"
            className={tabButtonClass(activeTab === t.key)}
            onClick={() => navigate(toPath[t.key])}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <ActivePage />
    </div>
  );
}

