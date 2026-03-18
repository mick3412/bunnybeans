import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminPromotionsPage } from '../AdminPromotionsPage';
import { AdminCrmJobsPage } from '../AdminCrmJobsPage';
import { AdminMarketingRulesPage } from '../AdminMarketingRulesPage';

export type MarketingCenterHubTabKey = 'promotions' | 'jobs' | 'marketingRules';

const TAB_OPTIONS: Array<{ key: MarketingCenterHubTabKey; label: string }> = [
  { key: 'promotions', label: '促銷規則' },
  { key: 'jobs', label: '行銷工作台（Jobs）' },
  { key: 'marketingRules', label: '行銷規則（常駐）' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminMarketingCenterHubPage(props: { initialTab?: MarketingCenterHubTabKey }) {
  const { initialTab } = props;

  const [hubParams, setHubParams] = useScopedSearchParams('marketing.hub');
  const tabFromUrl = (hubParams.get('tab') as MarketingCenterHubTabKey | null) ?? null;
  const defaultTab: MarketingCenterHubTabKey = tabFromUrl ?? initialTab ?? 'promotions';

  const [activeTab, setActiveTab] = useState<MarketingCenterHubTabKey>(defaultTab);

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

