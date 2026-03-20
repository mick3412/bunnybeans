import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    active
      ? '!bg-[#1e293b] !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}

export function AdminOpsMonitoringHubPage(props: { initialTab?: OpsMonitoringHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [hubParams, setHubParams] = useScopedSearchParams('ops.monitoring.hub');
  const tabFromUrl = (hubParams.get('tab') as OpsMonitoringHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<OpsMonitoringHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/ops/jobs') return 'jobs';
    if (p === '/admin/ops/report-clicks') return 'clicks';
    if (p === '/admin' || p === '/admin/') return 'overview';
    return null;
  }, [location.pathname]);

  const defaultTab: OpsMonitoringHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'overview';
  const [activeTab, setActiveTab] = useState<OpsMonitoringHubTabKey>(defaultTab);

  const toPath = useMemo<Record<OpsMonitoringHubTabKey, string>>(
    () => ({
      overview: '/admin',
      jobs: '/admin/ops/jobs',
      clicks: '/admin/ops/report-clicks',
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

