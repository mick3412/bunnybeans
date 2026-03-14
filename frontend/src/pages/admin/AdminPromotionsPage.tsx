import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  listMerchants,
  listPromotionRules,
  deletePromotionRule,
  type PromotionRuleDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '進行中' },
  { key: 'scheduled', label: '排程中' },
  { key: 'draft', label: '草稿' },
  { key: 'ended', label: '已結束' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-[#28A745]/12 text-[#28A745] ring-1 ring-[#28A745]/20',
    scheduled: 'bg-[#7EACB5]/10 text-[#7EACB5] ring-1 ring-[#7EACB5]/15',
    draft: 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200/80',
    ended: 'bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200/60',
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

export const AdminPromotionsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'all';
  const q = searchParams.get('q') || '';
  const [merchantId, setMerchantId] = useState<string>('');
  const [rows, setRows] = useState<PromotionRuleDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(q);

  const load = useCallback(async () => {
    if (!merchantId) return;
    const res = await listPromotionRules({ merchantId, status, q });
    if ('statusCode' in res) {
      setErr(getErrorMessage(res as ApiError));
      setRows([]);
      return;
    }
    setErr(null);
    setRows(res);
  }, [merchantId, status, q]);

  useEffect(() => {
    (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) setMerchantId(m[0].id);
    })();
  }, []);

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

  return (
    <div className="min-h-full bg-[#F4F8F9] pb-12">
      <div className="border-b border-neutral-200/80 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-600">管理商店的行銷自動化規則</p>
          </div>
          <Button
            type="button"
            variant="primary"
            className="rounded-xl px-5 shadow-md shadow-[#7EACB5]/20"
            onClick={() => navigate(`/admin/promotions/new?merchantId=${merchantId}`)}
            disabled={!merchantId}
          >
            + 新增促銷
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  status === t.key
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-white text-neutral-600 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex min-w-0 flex-1 sm:max-w-sm sm:ml-auto">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
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
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-neutral-400 focus:border-[#7EACB5] focus:outline-none focus:ring-2 focus:ring-[#7EACB5]/15"
              placeholder="搜尋促銷…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </div>
        </div>

        {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#E3342F]">
            {err}
          </div>
        )}

        <div className="space-y-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-stretch gap-0 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition hover:border-neutral-200 hover:shadow-md"
            >
              <Link
                to={`/admin/promotions/${r.id}?merchantId=${merchantId}`}
                className="group flex min-w-0 flex-1 cursor-pointer items-stretch gap-4 p-5 pr-3 outline-none ring-inset transition hover:bg-neutral-50/80 focus-visible:ring-2 focus-visible:ring-[#7EACB5]"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-neutral-900 group-hover:text-[#7EACB5]">
                      {r.name}
                    </span>
                    {statusBadge(r.status)}
                    {r.exclusive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        <span className="h-1.5 w-1.5 rounded-full border-2 border-neutral-400" />
                        排他
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.summary}</p>
                </div>
                <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-[#F4F8F9] px-5 py-3 text-center ring-1 ring-neutral-100">
                  <span className="text-xs font-medium text-neutral-500">優先級</span>
                  <span className="text-2xl font-bold tabular-nums text-neutral-900">
                    {r.priority}
                  </span>
                </div>
              </Link>
              <div className="flex shrink-0 items-stretch border-l border-neutral-100 bg-white">
                <button
                  type="button"
                  className="px-4 py-5 text-sm font-medium text-[#E3342F] transition hover:bg-red-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm('刪除此規則？')) return;
                    const out = await deletePromotionRule(r.id, merchantId);
                    if (out && 'statusCode' in out) {
                      const msg = getErrorMessage(out);
                      setErr(msg);
                      showToast(msg, 'err');
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
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white/80 py-16 text-center">
              <p className="text-sm font-medium text-neutral-500">尚無促銷規則</p>
              <p className="mt-1 text-xs text-neutral-400">點「新增促銷」建立第一則活動</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
