import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  listPromotionRules,
  deletePromotionRule,
  getPromotionEffectiveness,
  reorderPromotionRules,
  type PromotionRuleDto,
  type PromotionEffectivenessItem,
  type ApiError,
} from '../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { getErrorMessage, showAdminApiErrorToast } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';
import { AdminPromotionEditPage } from './AdminPromotionEditPage';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '進行中' },
  { key: 'scheduled', label: '排程中' },
  { key: 'draft', label: '草稿' },
  { key: 'ended', label: '已結束' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-[#16a34a]/12 text-[#16a34a] ring-1 ring-[#16a34a]/20',
    scheduled: 'bg-[#0ea5e9]/10 text-[#0ea5e9] ring-1 ring-[#0ea5e9]/20',
    draft: 'bg-[#f8fafc] text-[#64748b] ring-1 ring-[#e2e8f0]',
    ended: 'bg-[#f8fafc] text-[#64748b] ring-1 ring-[#e2e8f0]',
  };
  const label: Record<string, string> = {
    active: '進行中',
    scheduled: '排程中',
    draft: '草稿',
    ended: '已結束',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? map.draft}`}
    >
      {label[status] ?? status}
    </span>
  );
}

const PANEL_WIDTH_EXPANDED = 480;
const PANEL_WIDTH_COLLAPSED = 48;

export const AdminPromotionsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'all';
  const q = searchParams.get('q') || '';
  const merchantId = useDefaultMerchantId();
  const [rows, setRows] = useState<PromotionRuleDto[]>([]);
  const [effectiveness, setEffectiveness] = useState<Record<string, PromotionEffectivenessItem>>({});
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const panelOpen = Boolean(routeId);
  const [sorting, setSorting] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [beforeSortRows, setBeforeSortRows] = useState<PromotionRuleDto[] | null>(null);

  const load = useCallback(async () => {
    if (!merchantId) return;
    const [res, effRes] = await Promise.all([
      listPromotionRules({ merchantId, status, q }),
      getPromotionEffectiveness({ merchantId, preset: 'last30d' }),
    ]);
    if ('statusCode' in res) {
      const msg = getErrorMessage(res as ApiError);
      setErr(msg);
      showAdminApiErrorToast(showToast, res as ApiError);
      setRows([]);
      setEffectiveness({});
      return;
    }
    setErr(null);
    setRows(res);
    if (effRes && !('statusCode' in effRes) && effRes.items) {
      const map: Record<string, PromotionEffectivenessItem> = {};
      for (const item of effRes.items) {
        map[item.ruleId] = item;
      }
      setEffectiveness(map);
    } else {
      setEffectiveness({});
    }
  }, [merchantId, status, q, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('status', key);
    setSearchParams(next);
  };

  const applySearch = () => {
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('q', searchInput.trim());
    else next.delete('q');
    setSearchParams(next);
  };

  const closePanel = useCallback(() => {
    navigate(`/admin/promotions${merchantId ? `?merchantId=${merchantId}` : ''}`);
  }, [navigate, merchantId]);

  const handleSaved = useCallback(() => {
    load();
    closePanel();
  }, [load, closePanel]);

  const applyReorder = useCallback(
    async (nextRows: PromotionRuleDto[]) => {
      if (!merchantId) return;
      if (sorting) return;
      const prev = rows;
      setSorting(true);
      setBeforeSortRows(prev);
      setRows(nextRows);
      const out = await reorderPromotionRules(merchantId, nextRows.map((r) => r.id));
      setSorting(false);
      if (out && typeof out === 'object' && 'statusCode' in out) {
        showToast(getErrorMessage(out as ApiError), 'err');
        setRows(prev);
        return;
      }
      showToast('已更新排序', 'ok');
      // 以 refetch 當作單一真相，避免競態造成 priority 漂移
      load();
    },
    [merchantId, sorting, rows, showToast, load],
  );

  return (
    <>
    <div className="mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted">管理商店的行銷自動化規則；成效為近 30 日統計</p>
        <Button
          type="button"
          variant="primary"
          className="rounded-xl px-5 shadow-md shadow-[#0ea5e9]/20"
          onClick={() => navigate(`/admin/promotions/new?merchantId=${merchantId}`)}
          disabled={!merchantId}
        >
          + 新增促銷
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  status === t.key
                    ? 'bg-[#1e293b] text-white shadow-sm'
                    : 'bg-white text-[#64748b] shadow-sm ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex min-w-0 flex-1 sm:max-w-sm sm:ml-auto">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-muted focus:border-[#0ea5e9] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20"
              placeholder="搜尋促銷…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </div>
      </div>

      {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

      <div className="space-y-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className={[
                'flex flex-wrap items-stretch gap-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition hover:border-[#e2e8f0] hover:shadow-md',
                dragOverId === r.id ? 'ring-2 ring-[#0ea5e9]/30' : '',
              ].join(' ')}
              onDragOver={(e) => {
                if (!dragId || dragId === r.id) return;
                e.preventDefault();
                setDragOverId(r.id);
              }}
              onDragLeave={() => {
                if (dragOverId === r.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromId = dragId;
                const toId = r.id;
                setDragOverId(null);
                setDragId(null);
                if (!fromId || fromId === toId) return;
                const fromIdx = rows.findIndex((x) => x.id === fromId);
                const toIdx = rows.findIndex((x) => x.id === toId);
                if (fromIdx < 0 || toIdx < 0) return;
                const next = rows.slice();
                const [moved] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, moved);
                void applyReorder(next);
              }}
            >
              <Link
                to={`/admin/promotions/${r.id}?merchantId=${merchantId}`}
                className={[
                  'group flex min-w-0 flex-1 cursor-pointer items-stretch gap-4 p-5 pr-3 outline-none ring-inset transition hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#0ea5e9]',
                  sorting ? 'pointer-events-none opacity-70' : '',
                ].join(' ')}
                aria-disabled={sorting ? true : undefined}
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      draggable
                      disabled={sorting}
                      className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-muted hover:border-[#0ea5e9]/30 disabled:opacity-50"
                      title="拖曳調整排序"
                      aria-label="拖曳調整排序"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragId(r.id);
                        setBeforeSortRows(rows);
                        try {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', r.id);
                        } catch {
                          /* ignore */
                        }
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverId(null);
                      }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M10 6h4v2h-4V6zm0 5h4v2h-4v-2zm0 5h4v2h-4v-2z" />
                      </svg>
                    </button>
                    <div className="mr-1 flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={sorting || rows.findIndex((x) => x.id === r.id) <= 0}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-muted hover:border-[#0ea5e9]/30 disabled:opacity-50"
                        title="上移"
                        aria-label="上移"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const idx = rows.findIndex((x) => x.id === r.id);
                          if (idx <= 0) return;
                          const next = rows.slice();
                          const tmp = next[idx - 1];
                          next[idx - 1] = next[idx];
                          next[idx] = tmp;
                          void applyReorder(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={sorting || rows.findIndex((x) => x.id === r.id) >= rows.length - 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-muted hover:border-[#0ea5e9]/30 disabled:opacity-50"
                        title="下移"
                        aria-label="下移"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const idx = rows.findIndex((x) => x.id === r.id);
                          if (idx < 0 || idx >= rows.length - 1) return;
                          const next = rows.slice();
                          const tmp = next[idx + 1];
                          next[idx + 1] = next[idx];
                          next[idx] = tmp;
                          void applyReorder(next);
                        }}
                      >
                        ↓
                      </button>
                    </div>
                    <span className="text-base font-semibold text-[#1e293b] group-hover:text-[#0ea5e9]">
                      {r.name}
                    </span>
                    {statusBadge(r.status)}
                    {r.exclusive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-0.5 text-xs font-medium text-[#64748b] ring-1 ring-[#e2e8f0]">
                        <span className="h-1.5 w-1.5 rounded-full border-2 border-[#64748b]" />
                        排他
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{r.summary}</p>
                  {(() => {
                    const eff = effectiveness[r.id];
                    if (!eff) return null;
                    return (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#64748b]">
                        <span>觸發 {eff.triggerCount} 次</span>
                        <span>折讓 {eff.discountTotal.toLocaleString()}</span>
                        <span>帶動 {eff.drivenRevenue.toLocaleString()}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-[#f8fafc] px-5 py-3 text-center ring-1 ring-[#e2e8f0]">
                  <span className="text-xs font-medium text-[#64748b]">優先級</span>
                  <span className="text-2xl font-bold tabular-nums text-[#1e293b]">
                    {r.priority}
                  </span>
                  {sorting && (
                    <span className="mt-1 text-[11px] font-medium text-muted">排序中…</span>
                  )}
                </div>
              </Link>
              <div className="flex shrink-0 items-stretch border-l border-[#e2e8f0] bg-white">
                <button
                  type="button"
                  disabled={sorting}
                  className="px-4 py-5 text-sm font-medium text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (sorting) return;
                    if (!confirm('刪除此規則？')) return;
                    const out = await deletePromotionRule(r.id, merchantId);
                    if (out && 'statusCode' in out) {
                      const msg = getErrorMessage(out as ApiError);
                      setErr(msg);
                      showAdminApiErrorToast(showToast, out as ApiError);
                    } else {
                      showToast('已刪除促銷規則');
                      load();
                    }
                  }}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
          {!rows.length && !err && (
            <div className="rounded-2xl border border-dashed border-[#e2e8f0] bg-white py-16 text-center">
              <p className="text-sm font-medium text-muted">尚無促銷規則</p>
              <p className="mt-1 text-xs text-[#64748b]">點「新增促銷」建立第一則活動</p>
            </div>
          )}
      </div>
    </div>

    {/* 右側懸浮：新增/編輯區（可收合） */}
    {panelOpen && (
      <div
        className="fixed right-0 top-0 z-20 flex h-full flex-col border-l border-[#e2e8f0] bg-white shadow-xl transition-[width] duration-200 ease-out"
        style={{ width: panelExpanded ? PANEL_WIDTH_EXPANDED : PANEL_WIDTH_COLLAPSED }}
      >
        {panelExpanded ? (
          <>
            <div className="flex shrink-0 items-center justify-end border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-1">
              <button
                type="button"
                onClick={() => setPanelExpanded(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:shadow-sm"
                aria-label="收合"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <AdminPromotionEditPage embed onClose={closePanel} onSaved={handleSaved} />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPanelExpanded(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-1 border-0 bg-transparent py-4 text-muted hover:bg-[#f8fafc]"
            aria-label="展開"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] font-medium">展開</span>
          </button>
        )}
      </div>
    )}
    </>
  );
};
