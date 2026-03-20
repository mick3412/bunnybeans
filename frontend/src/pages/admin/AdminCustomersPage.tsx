import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listLoyaltyCustomers, type LoyaltyCustomerRow } from '../../modules/admin/loyaltyApi';
import {
  mergeCustomers,
  getCustomerContacts,
  addCustomerContact,
  exportSegmentCsv,
  type ApiError,
  type CustomerContactItem,
} from '../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { TextInput } from '../../shared/components/TextInput';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useAdminToast } from './AdminToastContext';
import { getErrorMessage, showAdminApiErrorToast } from '../../shared/errors/errorMessages';

export const AdminCustomersPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<LoyaltyCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [contactsCustomer, setContactsCustomer] = useState<LoyaltyCustomerRow | null>(null);
  const [contactsItems, setContactsItems] = useState<CustomerContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [newContactType, setNewContactType] = useState('');
  const [newContactNote, setNewContactNote] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [segmentExportId, setSegmentExportId] = useState('');
  const [segmentExporting, setSegmentExporting] = useState(false);
  const [segmentExportErr, setSegmentExportErr] = useState<string | null>(null);

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
    const q = searchQ.trim().toLowerCase();
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
  }, [items, searchQ, levelFilter]);

  return (
    <>
    <StandardListLayout
      title="會員管理"
      description={
        <>
          資料來源 <code className="rounded bg-brand-canvas px-1 text-[#1e293b]">GET /customers?merchantId=</code>
          ；可篩選等級、搜尋姓名／電話／會員碼。使用 <strong>匯入</strong> 前往客戶 CSV 匯入、<strong>匯出</strong> 可下載分群名單 CSV。點擊「會員管理」進入 Loyalty 會員管理、「點數存摺」進入存摺。
        </>
      }
      actions={
        <>
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
            匯出
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
        </>
      }
      filters={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <TextInput
              label="搜尋"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="姓名、電話、會員碼"
              className="w-48 !py-1.5"
            />
            <div>
              <label className="mb-1 block text-xs text-muted">狀態</label>
              <select
                className="rounded-lg border border-brand-surface px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">標籤 (tag)</label>
              <select
                className="rounded-lg border border-brand-surface px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">全部</option>
                {tagsFromItems.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">等級</label>
              <select
                className="rounded-lg border border-brand-surface px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <option value="">全部</option>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {exportPanelOpen && (
            <div className="flex flex-wrap items-end gap-3 border-t border-brand-surface pt-3">
              <span className="w-full text-xs font-semibold text-muted">分群名單匯出</span>
              <input
                type="text"
                className="w-56 rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm font-mono focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                placeholder="分群 ID (Segment UUID)"
                value={segmentExportId}
                onChange={(e) => {
                  setSegmentExportId(e.target.value);
                  setSegmentExportErr(null);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={segmentExporting}
                onClick={async () => {
                  const id = segmentExportId.trim();
                  if (!id) {
                    setSegmentExportErr('缺少分群 ID');
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
                <span className="text-sm text-red-600">{segmentExportErr}</span>
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
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${r.status === 'BLOCKED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
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
                          className="text-xs font-medium text-sky-700 hover:underline"
                          onClick={() => {
                            setContactsCustomer(r);
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
                          互動紀錄
                        </button>
                        <Link
                          to="/admin/customers"
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          會員管理
                        </Link>
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
      )}
    </StandardListLayout>

      {/* 合併會員 Modal */}
      {mergeOpen && selectedIds.size >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMergeOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold text-content">合併會員</h3>
            <p className="mb-3 text-sm text-muted">選留存主檔，其餘會員資料將併入主檔（訂單／點數存摺歸戶）。</p>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted">留存主檔</label>
              <select
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
          </div>
        </div>
      )}

      {/* 互動紀錄 Drawer */}
      {contactsCustomer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/25" aria-hidden onClick={() => setContactsCustomer(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-brand-surface bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-content">互動紀錄 — {contactsCustomer.name}</h3>
              <button type="button" className="rounded px-2 py-1 text-muted hover:bg-table-head" onClick={() => setContactsCustomer(null)}>關閉</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
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
              <div className="border-t pt-4">
                <div className="mb-2 text-sm font-medium text-muted">新增紀錄</div>
                <TextInput label="類型" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} placeholder="例：來電" className="!py-1.5" />
                <div className="mt-2">
                  <label className="mb-1 block text-xs text-muted">備註</label>
                  <textarea
                    className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                    if (!contactsCustomer || !newContactType.trim() || !merchantId) return;
                    setContactSubmitting(true);
                    const out = await addCustomerContact(contactsCustomer.id, { type: newContactType.trim(), note: newContactNote.trim() || undefined }, merchantId);
                    setContactSubmitting(false);
                    if ('statusCode' in out) {
                      showAdminApiErrorToast(showToast, out as ApiError);
                      return;
                    }
                    showToast('已新增互動紀錄', 'ok');
                    setNewContactType('');
                    setNewContactNote('');
                    const res = await getCustomerContacts(contactsCustomer.id, merchantId);
                    if (res && typeof res === 'object' && 'items' in res) setContactsItems(res.items);
                  }}
                >
                  {contactSubmitting ? '送出中…' : '送出'}
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
};
