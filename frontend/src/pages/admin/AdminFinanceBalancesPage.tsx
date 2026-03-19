import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import { getFinanceBalances, type ApiError, type FinanceBalanceItem } from '../../modules/admin/adminApi';
import { listLoyaltyCustomers } from '../../modules/admin/loyaltyApi';
import { listSuppliers } from '../../modules/admin/purchaseApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { formatPartyDisplay, getPartyKindFromId } from '../../shared/utils/partyDisplay';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../shared/components/Button';
import { PartyViewSegmented, type PartyView } from '../../shared/components/PartyViewSegmented';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Alert } from '../../shared/components/Alert';

export const AdminFinanceBalancesPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const [searchParams, setSearchParams] = useScopedSearchParams('finance.balances');
  const [items, setItems] = useState<FinanceBalanceItem[]>([]);
  const viewFromUrl = (searchParams.get('view') as PartyView | null) ?? 'all';
  const partyIdFromUrl = searchParams.get('partyId') ?? '';
  const [view, setView] = useState<PartyView>(viewFromUrl);
  const [partyIdFilter, setPartyIdFilter] = useState(partyIdFromUrl);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!merchantId) return;
    let cancelled = false;
    (async () => {
      const names: Record<string, string> = {};
      const [custRes, supRes] = await Promise.all([
        listLoyaltyCustomers(merchantId),
        listSuppliers(merchantId),
      ]);
      if (cancelled) return;
      if (Array.isArray(custRes)) {
        custRes.forEach((c) => {
          const label = c.name ?? c.phone ?? c.id;
          names[c.id] = label;
          names[`CUSTOMER:${c.id}`] = label;
          names[`customer:${c.id}`] = label;
        });
      }
      if (supRes?.data) {
        supRes.data.forEach((s) => {
          const label = s.name ?? s.code ?? s.id;
          names[s.id] = label;
          names[`SUPPLIER:${s.id}`] = label;
          names[`supplier:${s.id}`] = label;
        });
      }
      setPartyNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    // 僅 customer/supplier 時傳 kind 給後端；other 需取全部再前端篩選
    const kindParam =
      view === 'customer' ? ('customer' as const) : view === 'supplier' ? ('supplier' as const) : undefined;
    const out = await getFinanceBalances({
      merchantId: merchantId ?? undefined,
      partyId: partyIdFilter.trim() || undefined,
      kind: kindParam,
    });
    if (out && typeof out === 'object' && 'items' in out) {
      setItems(out.items);
    } else {
      setErr(getErrorMessage(out as ApiError));
      setItems([]);
    }
    setLoading(false);
  }, [merchantId, partyIdFilter, view]);

  const filteredItems = useMemo(() => {
    if (view === 'all') return items;
    if (view === 'customer' || view === 'supplier') return items; // API 已依 kind 篩選
    return items.filter((row) => {
      const pid = row.partyId ?? '';
      const k = row.kind ?? getPartyKindFromId(pid);
      return k !== 'customer' && k !== 'supplier';
    });
  }, [items, view]);

  function getDisplayName(row: FinanceBalanceItem): string {
    return formatPartyDisplay(row.displayName, row.kind, row.partyId ?? '', partyNames);
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (view && view !== 'all') params.set('view', view);
    if (partyIdFilter.trim()) params.set('partyId', partyIdFilter.trim());
    setSearchParams(params, { replace: true });
  }, [partyIdFilter, setSearchParams, view]);

  const filters = (
    <div className="flex flex-wrap items-end gap-3">
      <PartyViewSegmented value={view} onChange={(v) => { setView(v); }} />
      <div>
        <label className="mb-1 block text-sm text-muted">對象 (partyId)</label>
        <input
          type="text"
          className="w-48 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
          placeholder="留空＝全部"
          value={partyIdFilter}
          onChange={(e) => setPartyIdFilter(e.target.value)}
        />
      </div>
      <Button size="sm" variant="secondary" onClick={() => void load()}>
        查詢
      </Button>
    </div>
  );

  return (
    <StandardListLayout
      title="應收應付餘額"
      description={
        <>
          資料來源 <code className="rounded bg-brand-surface px-1 text-content">GET /finance/balances</code>
          ；依金流事件重算應收／應付餘額。
        </>
      }
      filters={filters}
      aboveContent={err ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Alert variant="error">{err}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void load()}>重試</Button>
        </div>
      ) : undefined}
      loading={loading}
      error={null}
      empty={!loading && !err && filteredItems.length === 0}
      emptyMessage="尚無應收應付餘額紀錄"
      emptyDescription="可至金流報表確認是否有交易事件；有新交易後會依事件自動重算餘額"
      testId="e2e-admin-finance-balances"
    >
      {!loading && !err && filteredItems.length > 0 && (
        <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-muted">
              <tr>
                <th className="px-4 py-2">
                  {view === 'customer'
                    ? '會員對象'
                    : view === 'supplier'
                      ? '供應商對象'
                      : view === 'other'
                        ? '其他對象'
                        : '對象'}
                </th>
                <th className="px-4 py-2 font-mono text-xs">partyId</th>
                <th className="px-4 py-2 text-right">應收</th>
                <th className="px-4 py-2 text-right">應付</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.partyId} className="border-t border-brand-surface">
                  <td className="px-4 py-2 text-content" title={row.partyId}>
                    {getDisplayName(row)}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-2 font-mono text-[10px] text-muted" title={row.partyId}>
                    {row.partyId}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{row.receivable.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{row.payable.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StandardListLayout>
  );
};
