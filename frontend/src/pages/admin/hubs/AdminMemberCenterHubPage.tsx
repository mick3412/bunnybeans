import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { LoyaltyDashboardPage } from '../loyalty/LoyaltyDashboardPage';
import { LoyaltyPointLedgerPage } from '../loyalty/LoyaltyPointLedgerPage';
import { LoyaltySettingsPage } from '../loyalty/LoyaltySettingsPage';
import { LoyaltyTierRulesPage } from '../loyalty/LoyaltyTierRulesPage';
import { LoyaltyReportActivityPage } from '../LoyaltyReportActivityPage';
import { AdminCustomersPage } from '../AdminCustomersPage';

export type MemberCenterHubTabKey =
  | 'dashboard'
  | 'members'
  | 'pointLedger'
  | 'reports'
  | 'settings'
  | 'tierRules';

const TAB_OPTIONS: Array<{ key: MemberCenterHubTabKey; label: string }> = [
  { key: 'dashboard', label: '儀表板' },
  { key: 'members', label: '會員管理' },
  { key: 'pointLedger', label: '點數存摺' },
  { key: 'reports', label: '活動報表' },
  { key: 'settings', label: '集點設定' },
  { key: 'tierRules', label: '會員等級規則' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active
      ? '!bg-forge-sidebar !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}

export function AdminMemberCenterHubPage(props: { initialTab?: MemberCenterHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();

  const [hubParams, setHubParams] = useScopedSearchParams('member.hub');
  const tabFromUrl = (hubParams.get('tab') as MemberCenterHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<MemberCenterHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/loyalty') return 'dashboard';
    if (p === '/admin/loyalty/point-ledger') return 'pointLedger';
    if (p === '/admin/loyalty/reports') return 'reports';
    if (p === '/admin/loyalty/settings') return 'settings';
    if (p === '/admin/loyalty/tier-rules') return 'tierRules';
    if (p === '/admin/customers') return 'members';
    return null;
  }, [location.pathname]);

  const defaultTab: MemberCenterHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'dashboard';

  const [activeTab, setActiveTab] = useState<MemberCenterHubTabKey>(defaultTab);

  const toPath = useMemo<Record<MemberCenterHubTabKey, string>>(
    () => ({
      dashboard: '/admin/loyalty',
      members: '/admin/customers',
      pointLedger: '/admin/loyalty/point-ledger',
      reports: '/admin/loyalty/reports',
      settings: '/admin/loyalty/settings',
      tierRules: '/admin/loyalty/tier-rules',
    }),
    [],
  );

  useEffect(() => {
    // 從 URL 同步（避免用戶點擊後又被固定的 initialTab 覆蓋）
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
    if (activeTab === 'members') return AdminCustomersPage;
    if (activeTab === 'pointLedger') return LoyaltyPointLedgerPage;
    if (activeTab === 'reports') return LoyaltyReportActivityPage;
    if (activeTab === 'settings') return LoyaltySettingsPage;
    if (activeTab === 'tierRules') return LoyaltyTierRulesPage;
    return LoyaltyDashboardPage;
  }, [activeTab]);

  return (
    <div className="min-h-[calc(100vh-8rem)] min-w-0 overflow-auto p-4 lg:p-6" data-testid="e2e-admin-loyalty">
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
    </div>
  );
}

