import { useEffect, useMemo, useState } from 'react';
import {
  getDashboardSummary,
  getExpiringInventory,
  getFinanceBalances,
  getLoyaltyReportMembers,
  listOpsJobs,
} from '../../modules/admin/adminApi';
import { listPurchaseOrdersReceivable } from '../../modules/admin/purchaseApi';

export type AdminTodoTone = 'info' | 'warn' | 'danger' | 'neutral';

export type AdminTodoItem = {
  key: string;
  title: string;
  to: string;
  tone: AdminTodoTone;
  countText: string;
  metaText?: string;
  unavailable?: boolean;
};

function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

function asCountText(n: number | null, unit: string) {
  if (n == null) return '—';
  return `${formatInt(n)} ${unit}`;
}

export function useAdminTodoItems(merchantId: string | null) {
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | null>(null);
  const [pendingPoCount, setPendingPoCount] = useState<number | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);
  const [openReceivablesCount, setOpenReceivablesCount] = useState<number | null>(null);
  const [jobFailedCount, setJobFailedCount] = useState<number | null>(null);
  const [newMembersCount, setNewMembersCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getDashboardSummary();
      if (cancelled) return;
      if (res && typeof res === 'object' && 'statusCode' in res) {
        setLowStockCount(null);
        setLowStockThreshold(null);
        return;
      }
      const r = res as { skuLowStockCount?: number; lowStockThreshold?: number } | null;
      setLowStockCount(typeof r?.skuLowStockCount === 'number' ? r.skuLowStockCount : null);
      setLowStockThreshold(typeof r?.lowStockThreshold === 'number' ? r.lowStockThreshold : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!merchantId) {
      setPendingPoCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await listPurchaseOrdersReceivable(merchantId);
      if (cancelled) return;
      setPendingPoCount(r?.data?.length ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getExpiringInventory({ days: 30, take: 1 });
      if (cancelled) return;
      if (r && typeof r === 'object' && 'total' in r) {
        setExpiringCount(Number((r as { total?: number }).total) || 0);
      } else {
        setExpiringCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await getFinanceBalances();
      if (cancelled) return;
      if (b && typeof b === 'object' && 'items' in b) {
        const items = (b as { items?: { net?: number }[] }).items ?? [];
        const open = items.filter((x) => typeof x.net === 'number' && x.net > 0).length;
        setOpenReceivablesCount(open);
      } else {
        setOpenReceivablesCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const jobs = await listOpsJobs({ take: 50 });
      if (cancelled) return;
      if (jobs && typeof jobs === 'object' && 'items' in jobs) {
        const items = (jobs as { items?: { success?: boolean }[] }).items ?? [];
        setJobFailedCount(items.filter((j) => !j.success).length);
      } else {
        setJobFailedCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!merchantId) {
      setNewMembersCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await getLoyaltyReportMembers(merchantId, { preset: 'last30days' });
      if (cancelled) return;
      if (res && typeof res === 'object' && 'statusCode' in res) {
        setNewMembersCount(null);
      } else if (res && typeof res === 'object' && 'newMembers' in res) {
        setNewMembersCount(Number((res as { newMembers?: number }).newMembers) || 0);
      } else {
        setNewMembersCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const items = useMemo<AdminTodoItem[]>(() => {
    const out: AdminTodoItem[] = [
      {
        key: 'lowStock',
        title: '低庫存警告',
        to: '/admin/replenishment',
        tone: 'warn',
        countText: asCountText(lowStockCount, '筆'),
        metaText: lowStockThreshold != null ? `全倉 < ${formatInt(lowStockThreshold)} 件` : '建議優先補貨',
      },
      {
        key: 'expiringBatches',
        title: '即將到期批次',
        to: '/admin/inventory',
        tone: 'warn',
        countText: asCountText(expiringCount, '筆'),
        metaText: '30 日內到期',
      },
      {
        key: 'openReceivables',
        title: '未結清賒帳',
        to: '/admin/balances',
        tone: openReceivablesCount != null && openReceivablesCount > 0 ? 'danger' : 'neutral',
        countText: asCountText(openReceivablesCount, '人'),
        metaText: '需追蹤收款',
      },
      {
        key: 'jobFailed',
        title: 'Job 失敗',
        to: '/admin/ops/jobs',
        tone: jobFailedCount != null && jobFailedCount > 0 ? 'danger' : 'neutral',
        countText: asCountText(jobFailedCount, '筆'),
        metaText: '請確認重跑或排除',
      },
      {
        key: 'pendingReceiving',
        title: '待驗收採購單',
        to: '/admin/receiving-notes',
        tone: pendingPoCount != null && pendingPoCount > 0 ? 'info' : 'neutral',
        countText: asCountText(pendingPoCount, '筆'),
        metaText: '已下單待驗收',
      },
      {
        key: 'newMembers30d',
        title: '會員增長（近 30 日）',
        to: '/admin/customers',
        tone: 'info',
        countText: asCountText(newMembersCount, '人'),
        metaText: '會員新增趨勢',
      },
      {
        key: 'pointsExpiring',
        title: '會員點數到期',
        to: '/admin/loyalty/point-ledger',
        tone: 'neutral',
        countText: '待後端提供',
        unavailable: true,
        metaText: '將顯示即將到期點數',
      },
    ];
    return out;
  }, [expiringCount, openReceivablesCount, jobFailedCount, pendingPoCount, newMembersCount, lowStockCount, lowStockThreshold]);

  return { items };
}

