import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminPromotionsPage } from '../AdminPromotionsPage';
import { AdminCrmJobsPage } from '../AdminCrmJobsPage';
import { AdminMarketingRulesPage } from '../AdminMarketingRulesPage';
import { LoyaltyCouponsPage } from '../loyalty/LoyaltyCouponsPage';
import { AdminSegmentsPage } from '../AdminSegmentsPage';
import { AdminDispatchRulesPage } from '../AdminDispatchRulesPage';

export type MarketingCenterHubTabKey = 'promotions' | 'coupons' | 'segments' | 'dispatchRules' | 'jobs' | 'marketingRules';

const TAB_OPTIONS: Array<{ key: MarketingCenterHubTabKey; label: string }> = [
  { key: 'promotions', label: '促銷規則' },
  { key: 'coupons', label: '優惠券' },
  { key: 'segments', label: '分群管理' },
  { key: 'dispatchRules', label: '發券規則' },
  { key: 'jobs', label: '行銷工作台（Jobs）' },
  { key: 'marketingRules', label: '行銷規則（常駐）' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active
      ? '!bg-[#1e293b] !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-[#64748b] ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}

export function AdminMarketingCenterHubPage(props: { initialTab?: MarketingCenterHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();

  const [hubParams, setHubParams] = useScopedSearchParams('marketing.hub');
  const tabFromUrl = (hubParams.get('tab') as MarketingCenterHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<MarketingCenterHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/promotions') return 'promotions';
    if (p.startsWith('/admin/promotions/')) return 'promotions';
    if (p === '/admin/loyalty/coupons') return 'coupons';
    if (p === '/admin/segments') return 'segments';
    if (p === '/admin/dispatch-rules') return 'dispatchRules';
    if (p === '/admin/crm/jobs') return 'jobs';
    if (p === '/admin/marketing/rules') return 'marketingRules';
    return null;
  }, [location.pathname]);

  const defaultTab: MarketingCenterHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'promotions';

  const [activeTab, setActiveTab] = useState<MarketingCenterHubTabKey>(defaultTab);

  const toPath = useMemo<Record<MarketingCenterHubTabKey, string>>(
    () => ({
      promotions: '/admin/promotions',
      coupons: '/admin/loyalty/coupons',
      segments: '/admin/segments',
      dispatchRules: '/admin/dispatch-rules',
      jobs: '/admin/crm/jobs',
      marketingRules: '/admin/marketing/rules',
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
    if (activeTab === 'coupons') return LoyaltyCouponsPage;
    if (activeTab === 'segments') return AdminSegmentsPage;
    if (activeTab === 'dispatchRules') return AdminDispatchRulesPage;
    if (activeTab === 'jobs') return AdminCrmJobsPage;
    if (activeTab === 'marketingRules') return AdminMarketingRulesPage;
    return AdminPromotionsPage;
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

