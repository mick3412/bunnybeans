import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listLoyaltyCustomers, type LoyaltyCustomerRow } from '../../modules/admin/loyaltyApi';
import {
  mergeCustomers,
  createCustomer,
  patchCustomer,
  getCustomerContacts,
  addCustomerContact,
  exportSegmentCsv,
  listSegments,
  fetchCsvExport,
  type ApiError,
  type CustomerContactItem,
} from '../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { TextInput } from '../../shared/components/TextInput';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useAdminToast } from './AdminToastContext';
import { Modal } from '../../shared/components/Modal';
import { getErrorMessage, showAdminApiErrorToast } from '../../shared/errors/errorMessages';

export const AdminCustomersPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<LoyaltyCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const searchQDebounced = useDebouncedValue(searchQ, 300);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [contactsItems, setContactsItems] = useState<CustomerContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [newContactType, setNewContactType] = useState('');
  const [newContactNote, setNewContactNote] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [segmentExportId, setSegmentExportId] = useState('');
  const [segmentExporting, setSegmentExporting] = useState(false);
  const [segmentExportErr, setSegmentExportErr] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [editCustomer, setEditCustomer] = useState<LoyaltyCustomerRow | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '', memberLevel: '', memberCode: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [listExporting, setListExporting] = useState(false);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    if (!merchantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const out = await listLoyaltyCustomers(merchantId, {
      status: statusFilter || undefined,
      tag: tagFilter.trim() || undefined,
    });
    setLoading(false);
    if ('statusCode' in out) {
      const msg = getErrorMessage(out as ApiError);
      setErr(msg);
      showAdminApiErrorToast(showToast, out as ApiError);
      setItems([]);
    } else {
      setItems(Array.isArray(out) ? out : []);
    }
  }, [merchantId, statusFilter, tagFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      const out = await listSegments(merchantId, 1, 200);
      if ('items' in out && Array.isArray(out.items)) {
        setSegments(out.items.map((s) => ({ id: s.id, name: s.name })));
      } else {
        setSegments([]);
      }
    })();
  }, [merchantId]);

  const levels = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => {
      if (r.memberLevel?.trim()) set.add(r.memberLevel.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  const tagsFromItems = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => {
      (r.tags ?? []).forEach((t) => t?.trim() && set.add(t.trim()));
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    const q = searchQDebounced.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.phone && r.phone.includes(q)) ||
          (r.memberCode && r.memberCode.toLowerCase().includes(q)) ||
          (r.code && r.code.toLowerCase().includes(q)),
      );
    }
    if (levelFilter) {
      list = list.filter((r) => (r.memberLevel ?? '') === levelFilter);
    }
    return list;
  }, [items, searchQDebounced, levelFilter]);

  const hasActiveFilters = !!searchQ.trim() || !!statusFilter || !!tagFilter || !!levelFilter;
  const clearFilters = () => {
    setSearchQ('');
    setStatusFilter('');
    setTagFilter('');
    setLevelFilter('');
  };

  return (
    <>
    <StandardListLayout
      title="會員管理"
      filters={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 rounded-2xl border border-brand-surface bg-table-head px-3 py-3">
            <div className="mb-1 text-xs font-semibold text-muted">篩選</div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-medium text-muted">搜尋</span>
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="姓名、電話、會員碼"
                className="h-7 w-48 rounded-lg border border-brand-surface bg-white px-2 text-xs placeholder:text-muted"
              />
            </div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-medium text-muted">狀態</span>
              {['', 'ACTIVE', 'BLOCKED'].map((v) => {
                const selected = statusFilter === v;
                return (
                  <button
                    key={v || 'all'}
                    type="button"
                    onClick={() => setStatusFilter(v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      selected ? 'bg-brand-primary text-white' : 'bg-white text-content hover:bg-brand-surface border border-brand-surface'
                    }`}
                  >
                    {v || '全部'}
                  </button>
                );
              })}
            </div>
            {levels.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs font-medium text-muted">等級</span>
                {['', ...levels].map((l) => {
                  const selected = levelFilter === l;
                  return (
                    <button
                      key={l || 'all'}
                      type="button"
                      onClick={() => setLevelFilter(l)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-white text-content hover:bg-brand-surface border border-brand-surface'
                      }`}
                    >
                      {l || '全部'}
                    </button>
                  );
                })}
              </div>
            )}
            {tagsFromItems.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs font-medium text-muted">標籤</span>
                {['', ...tagsFromItems].map((t) => {
                  const selected = tagFilter === t;
                  return (
                    <button
                      key={t || 'all'}
                      type="button"
                      onClick={() => setTagFilter(t)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        selected ? 'bg-brand-primary text-white' : 'bg-white text-content hover:bg-brand-surface border border-brand-surface'
                      }`}
                    >
                      {t || '全部'}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>共 {filtered.length} 件</span>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="underline hover:text-content">
                  清除篩選
                </button>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={listExporting || !merchantId}
                onClick={async () => {
                  if (!merchantId) return;
                  setListExporting(true);
                  const q = new URLSearchParams();
                  q.set('merchantId', merchantId);
                  if (searchQDebounced.trim()) q.set('search', searchQDebounced.trim());
                  if (statusFilter) q.set('status', statusFilter);
                  if (tagFilter) q.set('tag', tagFilter);
                  if (levelFilter) q.set('memberLevel', levelFilter);
                  const path = `customers/export?${q.toString()}`;
                  const out = await fetchCsvExport(path, 'customers.csv');
                  setListExporting(false);
                  if (out !== true) showToast(getErrorMessage(out as ApiError), 'err');
                }}
              >
                {listExporting ? '匯出中…' : '全部匯出'}
              </Button>
              <Link to="/admin/customers/import">
                <Button type="button" size="sm" variant="primary" className="shadow-sm">
                  匯入
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setExportPanelOpen((o) => !o)}
                aria-expanded={exportPanelOpen}
              >
                分群匯出
              </Button>
              {selectedIds.size >= 2 && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setMergeOpen(true);
                    setMergePrimaryId(Array.from(selectedIds)[0] ?? '');
                  }}
                >
                  合併會員
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => {
                  setEditCustomer(null);
                  setCreateForm({ name: '', phone: '', email: '', memberLevel: '', memberCode: '' });
                  setPanelMode('create');
                  setPanelOpen(true);
                }}
              >
                新增會員
              </Button>
            </div>
          </div>
          {exportPanelOpen && (
            <div className="mt-2 flex flex-wrap items-end gap-3 border-t border-brand-surface pt-3">
              <span className="w-full text-xs font-semibold text-muted">分群名單匯出</span>
              <select
                className="min-w-[180px] rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm text-content focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={segmentExportId}
                onChange={(e) => {
                  setSegmentExportId(e.target.value);
                  setSegmentExportErr(null);
                }}
              >
                <option value="">— 選擇分群 —</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={segmentExporting}
                onClick={async () => {
                  const id = segmentExportId.trim();
                  if (!id) {
                    setSegmentExportErr('請選擇分群');
                    return;
                  }
                  setSegmentExporting(true);
                  setSegmentExportErr(null);
                  const out = await exportSegmentCsv(id);
                  setSegmentExporting(false);
                  if (out === true) {
                    showToast('已下載分群名單 CSV');
                  } else {
                    const msg = getErrorMessage(out as ApiError);
                    setSegmentExportErr(msg);
                    showAdminApiErrorToast(showToast, out as ApiError);
                  }
                }}
              >
                {segmentExporting ? '下載中…' : '下載 CSV'}
              </Button>
              {segmentExportErr && (
                <span className="text-sm text-brand-danger">{segmentExportErr}</span>
              )}
            </div>
          )}
        </div>
      }
      loading={loading}
      error={err}
      empty={!loading && filtered.length === 0}
      emptyMessage={items.length === 0 ? '尚無會員資料' : '無符合篩選條件的會員'}
      testId="e2e-admin-customers"
    >
      {!loading && filtered.length > 0 && (
      <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-xs text-muted">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedIds(new Set(filtered.map((r) => r.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th className="px-3 py-2">會員碼</th>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">電話</th>
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">等級</th>
                <th className="px-3 py-2 text-right">點數</th>
                <th className="px-3 py-2 text-right">即將到期</th>
                <th className="px-3 py-2">到期日</th>
                <th className="px-3 py-2">加入日</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-table-head">
                    <td className="w-10 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedIds((s) => new Set([...s, r.id]));
                          else setSelectedIds((s) => { const n = new Set(s); n.delete(r.id); return n; });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.memberCode ?? r.code ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 tabular-nums">{r.phone ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.status ? (
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${r.status === 'BLOCKED' ? 'bg-brand-danger/20 text-brand-danger' : 'bg-brand-success/20 text-brand-success'}`}>
                          {r.status}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-primary hover:underline"
                          onClick={() => {
                            setEditCustomer(r);
                            setCreateForm({
                              name: r.name ?? '',
                              phone: r.phone ?? '',
                              email: r.email ?? '',
                              memberLevel: r.memberLevel ?? '',
                              memberCode: r.memberCode ?? r.code ?? '',
                            });
                            setPanelMode('edit');
                            setPanelOpen(true);
                            setContactsItems([]);
                            setNewContactType('');
                            setNewContactNote('');
                            if (merchantId) {
                              setContactsLoading(true);
                              getCustomerContacts(r.id, merchantId).then((res) => {
                                setContactsLoading(false);
                                if (res && typeof res === 'object' && 'items' in res) setContactsItems(res.items);
                              });
                            }
                          }}
                        >
                          編輯
                        </button>
                        <Link
                          to={`/admin/loyalty/point-ledger?customerId=${encodeURIComponent(r.id)}`}
                          className="text-xs font-medium text-brand-primary hover:underline"
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
      )}
    </StandardListLayout>

      {/* 右緣懸浮：收起時可點開（向左展開表單） */}
      {!panelOpen && (
        <button
          type="button"
          className="fixed right-0 top-1/2 z-[95] flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-brand-primary bg-brand-primary px-2.5 py-6 text-xs font-semibold text-white shadow-lg transition hover:bg-brand-primary-hover"
          onClick={() => {
            setEditCustomer(null);
            setCreateForm({ name: '', phone: '', email: '', memberLevel: '', memberCode: '' });
            setPanelMode('create');
            setPanelOpen(true);
          }}
          title="新增會員"
          aria-label="新增會員"
        >
          <span className="[writing-mode:vertical-rl] tracking-widest">新增會員</span>
        </button>
      )}

      {/* 新增/編輯會員 Drawer */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25"
            aria-hidden
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-brand-surface bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-content">{panelMode === 'edit' ? '編輯會員' : '新增會員'}</h3>
              <button
                type="button"
                className="rounded px-2 py-1 text-muted hover:bg-table-head"
                onClick={() => setPanelOpen(false)}
              >
                關閉
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              <TextInput label="姓名 *" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="" />
              <TextInput label="電話" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="" />
              <TextInput label="Email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="" />
              <TextInput label="會員等級" value={createForm.memberLevel} onChange={(e) => setCreateForm((f) => ({ ...f, memberLevel: e.target.value }))} placeholder="" />
              <TextInput label="會員碼" value={createForm.memberCode} onChange={(e) => setCreateForm((f) => ({ ...f, memberCode: e.target.value }))} placeholder="" />
              {panelMode === 'edit' && editCustomer && (
                <div className="border-t border-brand-surface pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-content">互動紀錄</h4>
                  {contactsLoading ? (
                    <p className="text-sm text-muted">載入中…</p>
                  ) : (
                    <ul className="space-y-2">
                      {contactsItems.map((c) => (
                        <li key={c.id} className="rounded-lg border border-brand-surface bg-table-head p-2 text-xs">
                          <span className="font-mono text-muted">{c.type}</span>
                          {c.note && <p className="mt-1 text-muted">{c.note}</p>}
                          <p className="mt-1 text-muted">{new Date(c.createdAt).toLocaleString('zh-TW')}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-brand-surface pt-3">
                    <div className="mb-2 text-xs font-medium text-muted">新增紀錄</div>
                    <TextInput label="類型" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} placeholder="例：來電" className="!py-1.5" />
                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-muted">備註</label>
                      <textarea
                        className="w-full rounded-lg border border-brand-surface px-2 py-1.5 text-sm"
                        rows={2}
                        value={newContactNote}
                        onChange={(e) => setNewContactNote(e.target.value)}
                        placeholder="選填"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2"
                      disabled={contactSubmitting || !newContactType.trim()}
                      onClick={async () => {
                        if (!editCustomer || !newContactType.trim() || !merchantId) return;
                        setContactSubmitting(true);
                        const out = await addCustomerContact(editCustomer.id, { type: newContactType.trim(), note: newContactNote.trim() || undefined }, merchantId);
                        setContactSubmitting(false);
                        if ('statusCode' in out) {
                          showAdminApiErrorToast(showToast, out as ApiError);
                          return;
                        }
                        showToast('已新增互動紀錄', 'ok');
                        setNewContactType('');
                        setNewContactNote('');
                        const res = await getCustomerContacts(editCustomer.id, merchantId);
                        if (res && typeof res === 'object' && 'items' in res) setContactsItems(res.items);
                      }}
                    >
                      {contactSubmitting ? '送出中…' : '送出'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-brand-surface p-4">
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={createSaving || !createForm.name.trim()}
                onClick={async () => {
                  if (!createForm.name.trim()) return;
                  setCreateSaving(true);
                  if (panelMode === 'edit' && editCustomer) {
                    const out = await patchCustomer(editCustomer.id, {
                      name: createForm.name.trim(),
                      phone: createForm.phone.trim() || undefined,
                      email: createForm.email.trim() || undefined,
                      memberLevel: createForm.memberLevel.trim() || undefined,
                      memberCode: createForm.memberCode.trim() || undefined,
                    });
                    setCreateSaving(false);
                    if ('statusCode' in out) {
                      showAdminApiErrorToast(showToast, out as ApiError);
                      return;
                    }
                    showToast('已更新會員', 'ok');
                    setPanelOpen(false);
                    void load();
                    return;
                  }
                  if (!merchantId) return;
                  const out = await createCustomer({
                    merchantId,
                    name: createForm.name.trim(),
                    phone: createForm.phone.trim() || undefined,
                    email: createForm.email.trim() || undefined,
                    memberLevel: createForm.memberLevel.trim() || undefined,
                    memberCode: createForm.memberCode.trim() || undefined,
                  });
                  setCreateSaving(false);
                  if ('statusCode' in out) {
                    showAdminApiErrorToast(showToast, out as ApiError);
                    return;
                  }
                  showToast('已新增會員', 'ok');
                  setPanelOpen(false);
                  setCreateForm({ name: '', phone: '', email: '', memberLevel: '', memberCode: '' });
                  void load();
                }}
              >
                {createSaving ? (panelMode === 'edit' ? '儲存中…' : '建立中…') : panelMode === 'edit' ? '儲存' : '建立會員'}
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* 合併會員 Modal */}
      <Modal
        open={mergeOpen && selectedIds.size >= 2}
        onClose={() => setMergeOpen(false)}
        labelledBy="admin-customers-merge-title"
        className="z-50"
        panelClassName="w-full max-w-md rounded-xl bg-white p-4 shadow-xl"
      >
            <h2 id="admin-customers-merge-title" className="mb-3 text-base font-semibold text-content">
              合併會員
            </h2>
            <p className="mb-3 text-sm text-muted">選留存主檔，其餘會員資料將併入主檔（訂單／點數存摺歸戶）。</p>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted" id="admin-customers-merge-primary-label">留存主檔</label>
              <select
                id="admin-customers-merge-primary"
                aria-labelledby="admin-customers-merge-primary-label"
                className="w-full rounded-lg border border-brand-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                value={mergePrimaryId}
                onChange={(e) => setMergePrimaryId(e.target.value)}
              >
                {Array.from(selectedIds).map((id) => {
                  const r = items.find((x) => x.id === id);
                  return (
                    <option key={id} value={id}>
                      {r?.name ?? id.slice(0, 8)} ({id.slice(0, 8)})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMergeOpen(false)}>取消</Button>
              <Button
                type="button"
                variant="primary"
                disabled={mergeSubmitting}
                onClick={async () => {
                  const mergeIds = Array.from(selectedIds).filter((id) => id !== mergePrimaryId);
                  if (!mergeIds.length) return;
                  setMergeSubmitting(true);
                  const out = await mergeCustomers(mergePrimaryId, mergeIds);
                  setMergeSubmitting(false);
                  if ('statusCode' in out) {
                    showAdminApiErrorToast(showToast, out as ApiError);
                    return;
                  }
                  showToast('已合併會員', 'ok');
                  setMergeOpen(false);
                  setSelectedIds(new Set());
                  void load();
                }}
              >
                {mergeSubmitting ? '合併中…' : '確認合併'}
              </Button>
            </div>
      </Modal>

    </>
  );
};
