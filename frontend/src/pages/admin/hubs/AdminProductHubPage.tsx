import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminProductsPage } from '../AdminProductsPage';
import { AdminCategoriesPage } from '../AdminCategoriesPage';
import { AdminDiscountTagsPage } from '../AdminDiscountTagsPage';

export type ProductHubTabKey = 'products' | 'categories' | 'discountTags';

const TAB_OPTIONS: Array<{ key: ProductHubTabKey; label: string }> = [
  { key: 'products', label: '商品總覽' },
  { key: 'categories', label: '類別管理' },
  { key: 'discountTags', label: '折扣標籤' },
];

function tabButtonClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active
      ? '!bg-forge-sidebar !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}

export function AdminProductHubPage(props: { initialTab?: ProductHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [hubParams, setHubParams] = useScopedSearchParams('product.hub');
  const tabFromUrl = (hubParams.get('tab') as ProductHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<ProductHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/products') return 'products';
    if (p === '/admin/categories') return 'categories';
    if (p === '/admin/discount-tags') return 'discountTags';
    return null;
  }, [location.pathname]);

  const defaultTab: ProductHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'products';
  const [activeTab, setActiveTab] = useState<ProductHubTabKey>(defaultTab);

  const toPath = useMemo<Record<ProductHubTabKey, string>>(
    () => ({
      products: '/admin/products',
      categories: '/admin/categories',
      discountTags: '/admin/discount-tags',
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
    if (activeTab === 'categories') return AdminCategoriesPage;
    if (activeTab === 'discountTags') return AdminDiscountTagsPage;
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

