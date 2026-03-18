import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { LoyaltyDashboardPage } from '../loyalty/LoyaltyDashboardPage';
import { LoyaltyPointLedgerPage } from '../loyalty/LoyaltyPointLedgerPage';
import { LoyaltyCouponsPage } from '../loyalty/LoyaltyCouponsPage';
import { LoyaltySettingsPage } from '../loyalty/LoyaltySettingsPage';
import { LoyaltyTierRulesPage } from '../loyalty/LoyaltyTierRulesPage';
import { LoyaltyReportActivityPage } from '../LoyaltyReportActivityPage';
import { AdminSegmentsPage } from '../AdminSegmentsPage';
import { AdminDispatchRulesPage } from '../AdminDispatchRulesPage';
import { AdminCustomersPage } from '../AdminCustomersPage';

export type MemberCenterHubTabKey =
  | 'dashboard'
  | 'members'
  | 'pointLedger'
  | 'coupons'
  | 'reports'
  | 'settings'
  | 'tierRules'
  | 'segments'
  | 'dispatchRules';

const TAB_OPTIONS: Array<{ key: MemberCenterHubTabKey; label: string }> = [
  { key: 'dashboard', label: '儀表板' },
  { key: 'pointLedger', label: '點數存摺' },
  { key: 'coupons', label: '優惠券' },
  { key: 'reports', label: '活動報表' },
  { key: 'settings', label: '集點設定' },
  { key: 'tierRules', label: '會員等級規則' },
  { key: 'members', label: '會員管理' },
  { key: 'segments', label: '分群管理' },
  { key: 'dispatchRules', label: '發券規則' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminMemberCenterHubPage(props: { initialTab?: MemberCenterHubTabKey }) {
  const { initialTab } = props;

  const [hubParams, setHubParams] = useScopedSearchParams('member.hub');
  const tabFromUrl = (hubParams.get('tab') as MemberCenterHubTabKey | null) ?? null;
  const defaultTab: MemberCenterHubTabKey = tabFromUrl ?? initialTab ?? 'dashboard';

  const [activeTab, setActiveTab] = useState<MemberCenterHubTabKey>(defaultTab);

  useEffect(() => {
    if (!initialTab) return;
    if (activeTab === initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab, activeTab]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setHubParams(next, { replace: true });
  }, [activeTab, setHubParams]);

  const ActivePage = useMemo(() => {
    if (activeTab === 'members') return AdminCustomersPage;
    if (activeTab === 'segments') return AdminSegmentsPage;
    if (activeTab === 'dispatchRules') return AdminDispatchRulesPage;
    if (activeTab === 'pointLedger') return LoyaltyPointLedgerPage;
    if (activeTab === 'coupons') return LoyaltyCouponsPage;
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
              onClick={() => setActiveTab(t.key)}
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

