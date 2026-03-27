import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { AdminInventoryPage } from '../AdminInventoryPage';
import { AdminExpiringInventoryPage } from '../AdminExpiringInventoryPage';
import { AdminInventoryAdjustPage } from '../AdminInventoryAdjustPage';
import { AdminWarehousesStoresPage } from '../AdminWarehousesStoresPage';
import { HUB_TAB_ROW_CLASS, hubTabButtonClass } from './hubTabStyles';

export type InventoryQueryHubTabKey = 'balances' | 'slowMoving' | 'expiring' | 'adjust' | 'warehouses';

const TAB_OPTIONS: Array<{ key: InventoryQueryHubTabKey; label: string }> = [
  { key: 'balances', label: '庫存餘額' },
  { key: 'slowMoving', label: '滯銷品' },
  { key: 'expiring', label: '即期庫存' },
  { key: 'adjust', label: '入庫' },
  { key: 'warehouses', label: '倉庫/門市' },
];

export function AdminInventoryQueryHubPage(props: { initialTab?: InventoryQueryHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const [hubParams, setHubParams] = useScopedSearchParams('inventory.query.hub');
  const [invParams, setInvParams] = useScopedSearchParams('inventory.query');

  const tabFromUrl = (hubParams.get('tab') as InventoryQueryHubTabKey | null) ?? null;
  const tabFromPathname = useMemo<InventoryQueryHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/inventory/expiring') return 'expiring';
    if (p === '/admin/inventory/adjust') return 'adjust';
    if (p === '/admin/warehouses' || p === '/admin/stores') return 'warehouses';
    return null;
  }, [location.pathname]);

  const defaultTab: InventoryQueryHubTabKey = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'balances';

  const [activeTab, setActiveTab] = useState<InventoryQueryHubTabKey>(defaultTab);

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
    const nextHub = new URLSearchParams();
    nextHub.set('tab', activeTab);
    setHubParams(nextHub, { replace: true });
  }, [activeTab, setHubParams]);

  useEffect(() => {
    if (activeTab === 'balances' || activeTab === 'slowMoving') {
      const desired = activeTab === 'slowMoving' ? 'slowMoving' : 'balances';
      const nextInv = new URLSearchParams();
      nextInv.set('invView', desired);
      setInvParams(nextInv, { replace: true });
    }
  }, [activeTab, setInvParams]);

  return (
    <div className="space-y-4">
      <div className={HUB_TAB_ROW_CLASS}>
        {TAB_OPTIONS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant="secondary"
            className={hubTabButtonClass(activeTab === t.key)}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {activeTab === 'expiring' ? (
        <AdminExpiringInventoryPage />
      ) : activeTab === 'adjust' ? (
        <AdminInventoryAdjustPage />
      ) : activeTab === 'warehouses' ? (
        <AdminWarehousesStoresPage />
      ) : (
        <AdminInventoryPage embeddedInHub />
      )}
    </div>
  );
}

