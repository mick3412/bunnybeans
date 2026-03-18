import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminReportsPage } from '../AdminReportsPage';
import { AdminFinanceBalancesPage } from '../AdminFinanceBalancesPage';
import { AdminFinancePeriodsPage } from '../AdminFinancePeriodsPage';
import { AdminFinanceAuditPage } from '../AdminFinanceAuditPage';
import { AdminFinanceSnapshotsPage } from '../AdminFinanceSnapshotsPage';

export type FinanceHubTabKey = 'reports' | 'balances' | 'periods' | 'audit' | 'snapshots';

const TAB_OPTIONS: Array<{ key: FinanceHubTabKey; label: string }> = [
  { key: 'reports', label: '金流報表' },
  { key: 'balances', label: '應收應付餘額' },
  { key: 'periods', label: '關帳區間' },
  { key: 'audit', label: '稽核紀錄' },
  { key: 'snapshots', label: '金流快照' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminFinanceHubPage(props: { initialTab?: FinanceHubTabKey }) {
  const { initialTab } = props;
  const [hubParams, setHubParams] = useScopedSearchParams('finance.hub');
  const tabFromUrl = (hubParams.get('tab') as FinanceHubTabKey | null) ?? null;

  const defaultTab = tabFromUrl ?? initialTab ?? 'reports';
  const [activeTab, setActiveTab] = useState<FinanceHubTabKey>(defaultTab);

  useEffect(() => {
    if (!initialTab) return;
    if (activeTab === initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab, activeTab]);

  useEffect(() => {
    // 只保留 tab 相關 keys，避免 hub-level 與子頁篩選互串
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setHubParams(next, { replace: true });
  }, [activeTab, setHubParams]);

  const ActivePage = useMemo(() => {
    if (activeTab === 'reports') return AdminReportsPage;
    if (activeTab === 'balances') return AdminFinanceBalancesPage;
    if (activeTab === 'periods') return AdminFinancePeriodsPage;
    if (activeTab === 'audit') return AdminFinanceAuditPage;
    return AdminFinanceSnapshotsPage;
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
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <ActivePage />
    </div>
  );
}

