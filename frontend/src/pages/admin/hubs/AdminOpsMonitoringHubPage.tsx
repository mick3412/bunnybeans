import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminDashboardPage } from '../AdminDashboardPage';
import { AdminOpsJobsPage } from '../AdminOpsJobsPage';
import { AdminOpsReportClicksPage } from '../AdminOpsReportClicksPage';

export type OpsMonitoringHubTabKey = 'overview' | 'jobs' | 'clicks';

const TAB_OPTIONS: Array<{ key: OpsMonitoringHubTabKey; label: string }> = [
  { key: 'overview', label: '總覽' },
  { key: 'jobs', label: 'Job 監控' },
  { key: 'clicks', label: '穿透點擊審計' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminOpsMonitoringHubPage(props: { initialTab?: OpsMonitoringHubTabKey }) {
  const { initialTab } = props;
  const [hubParams, setHubParams] = useScopedSearchParams('ops.monitoring.hub');
  const tabFromUrl = (hubParams.get('tab') as OpsMonitoringHubTabKey | null) ?? null;
  const defaultTab: OpsMonitoringHubTabKey = tabFromUrl ?? initialTab ?? 'overview';
  const [activeTab, setActiveTab] = useState<OpsMonitoringHubTabKey>(defaultTab);

  useEffect(() => {
    if (!tabFromUrl) return;
    if (tabFromUrl === activeTab) return;
    setActiveTab(tabFromUrl);
  }, [tabFromUrl, activeTab]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setHubParams(next, { replace: true });
  }, [activeTab, setHubParams]);

  const ActivePage = useMemo(() => {
    if (activeTab === 'jobs') return AdminOpsJobsPage;
    if (activeTab === 'clicks') return AdminOpsReportClicksPage;
    return AdminDashboardPage;
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

