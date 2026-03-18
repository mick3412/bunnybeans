import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFinanceBalances, type ApiError, type FinanceBalanceItem } from '../../modules/admin/adminApi';
import { listLoyaltyCustomers } from '../../modules/admin/loyaltyApi';
import { listSuppliers } from '../../modules/admin/purchaseApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../shared/components/Button';
import { PartyViewSegmented, type PartyView } from '../../shared/components/PartyViewSegmented';

export const AdminFinanceBalancesPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const [searchParams, setSearchParams] = useSearchParams();
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
        });
      }
      if (supRes?.data) {
        supRes.data.forEach((s) => {
          const label = s.name ?? s.code ?? s.id;
          names[s.id] = label;
          names[`SUPPLIER:${s.id}`] = label;
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
  }, [partyIdFilter, view]);

  const filteredItems = useMemo(() => {
    if (view === 'all') return items;
    if (view === 'customer' || view === 'supplier') return items; // API 已依 kind 篩選
    return items.filter((row) => {
      const pid = row.partyId ?? '';
      const k = row.kind ?? (pid.startsWith('CUSTOMER:') ? 'customer' : pid.startsWith('SUPPLIER:') ? 'supplier' : '');
      return k !== 'customer' && k !== 'supplier';
    });
  }, [items, view]);

  function getDisplayName(row: FinanceBalanceItem): string {
    if (row.displayName?.trim()) return row.displayName.trim();
    const partyId = row.partyId ?? '';
    if (partyNames[partyId]) return partyNames[partyId];
    const [kind, refId] = partyId.includes(':') ? partyId.split(':', 2) : ['', partyId];
    if (!kind && partyNames[refId]) return partyNames[refId];
    if (kind === 'CUSTOMER') return '會員 ' + (partyNames[refId] ?? refId);
    if (kind === 'SUPPLIER') return '供應商 ' + (partyNames[refId] ?? refId);
    if (!partyId) return '—';
    return partyId;
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

  return (
    <div
      className="mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"
      data-testid="e2e-admin-finance-balances"
    >
      <p className="mb-4 text-sm text-muted">
        資料來源 <code className="rounded bg-[#f1f5f9] px-1 text-content">GET /finance/balances</code>
        ；依金流事件重算應收／應付餘額。可從「角色／來源視角」檢視平台與各對象往來，並可選填單一 partyId 鎖定特定客戶或供應商。
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PartyViewSegmented value={view} onChange={(v) => { setView(v); }} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-muted">對象 (partyId)</label>
          <input
            type="text"
            className="w-48 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm"
            placeholder="留空＝全部"
            value={partyIdFilter}
            onChange={(e) => setPartyIdFilter(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-content shadow-sm hover:bg-[#f8fafc]"
          onClick={() => void load()}
        >
          查詢
        </button>
      </div>

      {err && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-sm text-red-800">{err}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
            重試
          </Button>
        </div>
      )}

      {loading ? (
        <div className="table-sticky-head overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-muted">
              <tr>
                <th className="px-4 py-2">對象</th>
                <th className="px-4 py-2 font-mono text-xs">partyId</th>
                <th className="px-4 py-2 text-right">應收</th>
                <th className="px-4 py-2 text-right">應付</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-t border-[#e2e8f0]">
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 rounded bg-[#e2e8f0] animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 rounded bg-[#e2e8f0] animate-pulse" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-4 w-16 rounded bg-[#e2e8f0] animate-pulse" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-4 w-16 rounded bg-[#e2e8f0] animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredItems.length === 0 && !err ? (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white px-4 py-12 text-center">
          <p className="text-sm text-muted">目前尚無應收應付餘額紀錄</p>
          <p className="mt-2 text-xs text-muted">
            可至金流報表確認是否有交易事件；有新交易後會依事件自動重算餘額
          </p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => void load()}>
            重新載入
          </Button>
        </div>
      ) : (
        <div className="table-sticky-head overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-muted">
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
                <tr key={row.partyId} className="border-t border-slate-100">
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
    </div>
  );
};
