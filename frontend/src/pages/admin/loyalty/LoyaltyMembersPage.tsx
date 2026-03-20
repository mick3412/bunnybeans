/**
 * @legacy 本頁已棄用。會員管理統一由 AdminCustomersPage（/admin/customers）提供，
 * 路由 /admin/loyalty/members 已 redirect 至 /admin/customers。
 * 保留本檔僅供參考，不再於路由中渲染。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listLoyaltyCustomers,
  searchCustomers,
  type LoyaltyCustomerRow,
} from '../../../modules/admin/loyaltyApi';
import {
  createCustomer,
  getCustomer,
  patchCustomer,
  type CreateCustomerBody,
  type CustomerDetailDto,
} from '../../../modules/admin/adminApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { TextInput } from '../../../shared/components/TextInput';
import { Button } from '../../../shared/components/Button';
import { useAdminToast } from '../AdminToastContext';

type DrawerMode = 'create' | 'edit';

export const LoyaltyMembersPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const showToast = useAdminToast();
  const [rows, setRows] = useState<LoyaltyCustomerRow[]>([]);
  const [searchResults, setSearchResults] = useState<LoyaltyCustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetailDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    memberLevel: '',
    memberCode: '',
    joinDate: '',
  });
  const [manualLevelNote, setManualLevelNote] = useState('');

  const load = async () => {
    if (!merchantId) return;
    setErr(null);
    const out = await listLoyaltyCustomers(merchantId);
    if ('statusCode' in out) setErr((out as ApiError).message);
    else setRows(out);
  };

  useEffect(() => {
    void load();
  }, [merchantId]);

  useEffect(() => {
    const t = q.trim();
    if (!t || !merchantId) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        const out = await searchCustomers(merchantId, t);
        if ('statusCode' in out) {
          setSearchResults([]);
          setErr((out as ApiError).message);
        } else {
          setErr(null);
          setSearchResults(
            out.items.map((x) => ({
              id: x.id,
              name: x.name,
              phone: x.phone ?? undefined,
              memberLevel: x.memberLevel ?? undefined,
              memberCode: x.memberCode ?? undefined,
              code: x.memberCode ?? undefined,
            })),
          );
        }
        setSearching(false);
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [merchantId, q]);

  const openCreate = () => {
    setDrawerMode('create');
    setEditId(null);
    setDetail(null);
    setForm({ name: '', phone: '', email: '', memberLevel: '', memberCode: '', joinDate: '' });
    setDrawerOpen(true);
  };

  const openEdit = async (id: string) => {
    setDrawerMode('edit');
    setEditId(id);
    setDetail(null);
    setDrawerOpen(true);
    const out = await getCustomer(id);
    if ('statusCode' in out) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    const d = out as CustomerDetailDto;
    setDetail(d);
    setForm({
      name: d.name ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
      memberLevel: d.memberLevel ?? '',
      memberCode: d.memberCode ?? d.code ?? '',
      joinDate: d.joinDate ? d.joinDate.slice(0, 10) : '',
    });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditId(null);
    setDetail(null);
  };

  const submitCreate = async () => {
    if (!merchantId || !form.name.trim()) {
      showToast('缺少姓名', 'err');
      return;
    }
    setSaving(true);
    const out = await createCustomer({
      merchantId,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      memberLevel: form.memberLevel.trim() || undefined,
      memberCode: form.memberCode.trim() || undefined,
    });
    setSaving(false);
    if ('statusCode' in out) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    showToast('已新增會員', 'ok');
    closeDrawer();
    void load();
  };

  const submitEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const body: Partial<CustomerDetailDto> = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      memberLevel: form.memberLevel.trim() || undefined,
      memberCode: form.memberCode.trim() || undefined,
      code: form.memberCode.trim() || undefined,
    };
    if (form.joinDate) body.joinDate = form.joinDate;
    const out = await patchCustomer(editId, body);
    setSaving(false);
    if ('statusCode' in out) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    showToast('已更新會員', 'ok');
    closeDrawer();
    void load();
  };

  const filtered = useMemo(() => {
    if (q.trim()) return searchResults;
    return rows;
  }, [rows, q, searchResults]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="border-b border-brand-surface pb-2">
          <p className="text-sm text-muted">含點數餘額／即將到期；新增與編輯需後端 §7</p>
        </div>
        <div className="flex items-center gap-2">
          <TextInput
            label="搜尋"
            placeholder="姓名、電話、會員碼（GET /customers/search）"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[200px]"
          />
          {searching && <span className="text-xs text-muted">搜尋中…</span>}
          <Button type="button" onClick={openCreate}>
            新增會員
          </Button>
        </div>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brand-surface bg-table-head text-xs text-muted">
            <tr>
              <th className="px-3 py-2">會員碼</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">電話</th>
              <th className="px-3 py-2">等級</th>
              <th className="px-3 py-2 text-right">點數</th>
              <th className="px-3 py-2 text-right">即將到期</th>
              <th className="px-3 py-2">到期日</th>
              <th className="px-3 py-2">加入日</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-table-head">
                <td className="px-3 py-2 font-mono text-xs">{r.memberCode ?? '—'}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 tabular-nums">{r.phone ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.memberLevel ? (
                    <span className="rounded bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary">
                      {r.memberLevel}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pointBalance ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.expiringSoon ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {r.expiringAt ? new Date(r.expiringAt).toLocaleDateString('zh-TW') : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {r.joinDate ? new Date(r.joinDate).toLocaleDateString('zh-TW') : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-700 hover:underline"
                      onClick={() => void openEdit(r.id)}
                    >
                      編輯
                    </button>
                    <Link
                      to={`/admin/loyalty/point-ledger?customerId=${encodeURIComponent(r.id)}`}
                      className="text-xs font-medium text-sky-700 hover:underline"
                    >
                      點數存摺
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增／編輯 Drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25"
            aria-hidden
            onClick={closeDrawer}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-brand-surface bg-white shadow-xl"
            aria-label={drawerMode === 'create' ? '新增會員' : '編輯會員'}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <h3 className="font-semibold text-content">
                {drawerMode === 'create' ? '新增會員' : '編輯會員'}
              </h3>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-muted hover:bg-brand-canvas"
                onClick={closeDrawer}
              >
                關閉
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              {drawerMode === 'edit' && detail && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-table-head p-3 text-xs">
                    <div className="font-medium text-muted">點數與效期</div>
                    <div className="mt-1 text-muted">
                      點數餘額 {detail.pointBalance ?? 0} · 即將到期 {detail.expiringSoon ?? '—'} · 到期日{' '}
                      {detail.expiringAt ? new Date(detail.expiringAt).toLocaleDateString('zh-TW') : '—'}
                    </div>
                  </div>

                  <div className="rounded-lg border border-brand-surface bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-content">消費統計（預留）</div>
                      <span className="text-[11px] text-muted">預留</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-brand-surface bg-table-head px-3 py-2">
                        <div className="text-[11px] font-medium text-muted">最近一筆</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums text-content">—</div>
                        <div className="mt-0.5 text-[11px] text-muted">金額／時間</div>
                      </div>
                      <div className="rounded-md border border-brand-surface bg-table-head px-3 py-2">
                        <div className="text-[11px] font-medium text-muted">累計金額</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums text-content">—</div>
                        <div className="mt-0.5 text-[11px] text-muted">歷史訂單合計</div>
                      </div>
                      <div className="rounded-md border border-brand-surface bg-table-head px-3 py-2">
                        <div className="text-[11px] font-medium text-muted">消費頻率</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums text-content">—</div>
                        <div className="mt-0.5 text-[11px] text-muted">近 30 日 / 90 日</div>
                      </div>
                      <div className="rounded-md border border-brand-surface bg-table-head px-3 py-2">
                        <div className="text-[11px] font-medium text-muted">偏好品類</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums text-content">—</div>
                        <div className="mt-0.5 text-[11px] text-muted">Top 3</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-brand-surface bg-white p-3">
                    <div className="text-xs font-semibold text-content">偏好品類視覺化（預留）</div>
                    <div className="mt-2 space-y-2">
                      {['—', '—', '—'].map((label, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-16 truncate text-[11px] text-muted">{label}</div>
                          <div className="h-2 flex-1 rounded-full bg-brand-surface">
                            <div className="h-2 rounded-full bg-brand-primary/30" style={{ width: `${(3 - idx) * 20}%` }} />
                          </div>
                          <div className="w-10 text-right text-[11px] tabular-nums text-muted">—%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-[#cbd5f5] bg-[#eff6ff] p-3 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="font-medium text-[#1d4ed8]">手動調整會員等級</div>
                      <span className="text-[11px] text-muted">
                        僅限有 Admin Key 者在後台修改
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-[#1e293b]">輸入會員等級以更新畫面呈現。</p>
                    <div className="mb-2 rounded-md border border-dashed border-[#bfdbfe] bg-white/70 px-2 py-1.5">
                      <div className="text-[11px] font-medium text-[#1d4ed8]">
                        最近一次自動升降級（預留）
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">預留資訊區塊。</p>
                    </div>
                    <TextInput
                      label="手動指定等級（覆寫目前等級）"
                      value={form.memberLevel}
                      onChange={(e) => setForm((f) => ({ ...f, memberLevel: e.target.value }))}
                      placeholder=""
                    />
                    <TextInput
                      label="調整說明（僅備註用途，可填入原因與經辦人）"
                      value={manualLevelNote}
                      onChange={(e) => setManualLevelNote(e.target.value)}
                      placeholder=""
                    />
                  </div>
                </div>
              )}
              <TextInput
                label="姓名"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="必填"
              />
              <TextInput
                label="電話"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <TextInput
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <TextInput
                label="等級 (memberLevel)"
                value={form.memberLevel}
                onChange={(e) => setForm((f) => ({ ...f, memberLevel: e.target.value }))}
                placeholder="VIP, GOLD, NORMAL"
              />
              <TextInput
                label="會員碼 (memberCode)"
                value={form.memberCode}
                onChange={(e) => setForm((f) => ({ ...f, memberCode: e.target.value }))}
              />
              {drawerMode === 'edit' && (
                <TextInput
                  label="加入日"
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
                />
              )}
            </div>
            <div className="border-t border-neutral-100 p-4">
              <Button
                type="button"
                disabled={saving}
                onClick={() => (drawerMode === 'create' ? void submitCreate() : void submitEdit())}
              >
                {saving ? '儲存中…' : '儲存'}
              </Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
