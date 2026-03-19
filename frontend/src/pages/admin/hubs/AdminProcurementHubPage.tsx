import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminPurchaseOrdersPage } from '../AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from '../AdminReceivingNotesPage';
import { AdminReplenishmentPage } from '../AdminReplenishmentPage';

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
      ? '!bg-[#1e293b] !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminProcurementHubPage(props: { initialTab?: ProcurementHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [hubParams, setHubParams] = useScopedSearchParams('procurement.hub');

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

