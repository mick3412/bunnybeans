import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminProductsPage } from '../AdminProductsPage';
import { AdminCategoriesPage } from '../AdminCategoriesPage';

export type ProductHubTabKey = 'products' | 'categories';

const TAB_OPTIONS: Array<{ key: ProductHubTabKey; label: string }> = [
  { key: 'products', label: '商品主檔' },
  { key: 'categories', label: '類別管理' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminProductHubPage(props: { initialTab?: ProductHubTabKey }) {
  const { initialTab } = props;
  const [hubParams, setHubParams] = useScopedSearchParams('product.hub');
  const tabFromUrl = (hubParams.get('tab') as ProductHubTabKey | null) ?? null;
  const defaultTab: ProductHubTabKey = tabFromUrl ?? initialTab ?? 'products';
  const [activeTab, setActiveTab] = useState<ProductHubTabKey>(defaultTab);

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
    if (activeTab === 'categories') return AdminCategoriesPage;
    return AdminProductsPage;
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

