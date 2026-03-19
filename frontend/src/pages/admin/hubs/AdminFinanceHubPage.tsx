import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { useScopedSearchParams } from '../../../shared/utils/useScopedSearchParams';
import { useLocation, useNavigate } from 'react-router-dom';
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
    active
      ? '!bg-[#1e293b] !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-[#64748b] ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]',
  ].join(' ');
}

export function AdminFinanceHubPage(props: { initialTab?: FinanceHubTabKey }) {
  const { initialTab } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [hubParams, setHubParams] = useScopedSearchParams('finance.hub');
  const tabFromUrl = (hubParams.get('tab') as FinanceHubTabKey | null) ?? null;

  const tabFromPathname = useMemo<FinanceHubTabKey | null>(() => {
    const p = location.pathname;
    if (p === '/admin/reports') return 'reports';
    if (p === '/admin/balances') return 'balances';
    if (p === '/admin/finance/periods') return 'periods';
    if (p === '/admin/finance/audit') return 'audit';
    if (p === '/admin/finance/snapshots') return 'snapshots';
    return null;
  }, [location.pathname]);

  // 重要：由側欄路由導向時，依 pathname 決定目前應顯示的 tab
  // 否則 finance.hub.tab 可能因先前切換 tab 殘留而顯示錯誤內容。
  const defaultTab = tabFromPathname ?? tabFromUrl ?? initialTab ?? 'reports';
  const [activeTab, setActiveTab] = useState<FinanceHubTabKey>(defaultTab);

  const toPath = useMemo<Record<FinanceHubTabKey, string>>(
    () => ({
      reports: '/admin/reports',
      balances: '/admin/balances',
      periods: '/admin/finance/periods',
      audit: '/admin/finance/audit',
      snapshots: '/admin/finance/snapshots',
    }),
    [],
  );

  useEffect(() => {
    // 從 URL 同步（避免用戶點擊後又被固定的 initialTab 覆蓋）
    // 但若 pathname 已能推導出正確 tab（例如點側欄導向 /admin/reports），則以 pathname 為準，
    // 避免殘留的 finance.hub.tab 把畫面覆蓋回錯誤分頁。
    if (tabFromPathname) return;
    if (!tabFromUrl) return;
    if (tabFromUrl === activeTab) return;
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    // 路由變更時以 pathname 強制同步；避免側欄跳轉後 activeTab 使用到舊的 finance.hub.tab
    if (!tabFromPathname) return;
    if (tabFromPathname === activeTab) return;
    setActiveTab(tabFromPathname);
  }, [tabFromPathname, activeTab]);

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
            onClick={() => {
              // Hub tabs 是「跨路由」切換：用 navigate 確保不被 pathname 同步打回。
              navigate(toPath[t.key]);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <ActivePage />
    </div>
  );
}

