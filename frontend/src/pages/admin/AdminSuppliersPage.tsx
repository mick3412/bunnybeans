import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/components/Button';
import { TextInput } from '../../shared/components/TextInput';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  MOCK_MERCHANT,
  type SupplierDto,
  type ApiError,
} from '../../modules/admin/purchaseApi';
import { listMerchants, type MerchantDto } from '../../modules/admin/adminApi';
import { useAdminToast } from './AdminToastContext';

const PAYMENT_OPTIONS = ['現金', '月結15天', '月結30天', '月結60天', '預付全額'];

export const AdminSuppliersPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [merchantId, setMerchantId] = useState(MOCK_MERCHANT);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SupplierDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    paymentTerms: '月結30天',
    bankAccount: '',
    note: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const load = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const r = await listSuppliers(merchantId, q || undefined);
    setListLoading(false);
    if (r.error) {
      setListError(r.error.message);
      setRows([]);
      showToast(r.error.message, 'err');
      return;
    }
    setRows(r.data);
  }, [merchantId, q, showToast]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) setMerchantId((prev) => (prev === MOCK_MERCHANT ? m[0].id : prev));
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => loadRef.current(), 280);
    return () => clearTimeout(t);
  }, [q, merchantId]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      paymentTerms: '月結30天',
      bankAccount: '',
      note: '',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (s: SupplierDto) => {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email ?? '',
      address: s.address ?? '',
      taxId: s.taxId ?? '',
      paymentTerms: s.paymentTerms ?? '月結30天',
      bankAccount: s.bankAccount ?? '',
      note: s.note ?? '',
      status: s.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.contactPerson.trim()) {
      showToast('請填編號、名稱、聯絡人', 'err');
      return;
    }
    if (editing) {
      const out = await updateSupplier(editing.id, {
        code: form.code,
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
        taxId: form.taxId || undefined,
        paymentTerms: form.paymentTerms,
        bankAccount: form.bankAccount || undefined,
        note: form.note || undefined,
        status: form.status,
      });
      if ('statusCode' in out) {
        showToast(out.message, 'err');
        return;
      }
    } else {
      const out = await createSupplier({
        merchantId,
        code: form.code,
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        address: form.address,
        taxId: form.taxId,
        paymentTerms: form.paymentTerms,
        bankAccount: form.bankAccount,
        note: form.note,
        status: form.status,
      });
      if ('statusCode' in out) {
        showToast((out as ApiError).message, 'err');
        return;
      }
    }
    showToast('已儲存', 'ok');
    setModalOpen(false);
    load();
  };

  return (
    <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100" data-testid="e2e-admin-suppliers">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">供應商管理</h1>
          <p className="mt-1 text-sm text-neutral-500">管理供應商資料與聯絡資訊</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + 新增供應商
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/80 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            placeholder="搜尋供應商名稱 / 編號 / 聯絡人..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="text-sm font-medium text-neutral-600">{listLoading ? '…' : `${rows.length} 筆`}</span>
      </div>
      {listError && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>載入失敗：{listError}</span>
          <button type="button" className="rounded-md bg-red-100 px-3 py-1 font-medium hover:bg-red-200" onClick={() => load()}>
            重試
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-100">
        {listLoading ? (
          <div className="flex min-h-[200px] items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-label="載入中" />
          </div>
        ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/90 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">編號</th>
              <th className="px-4 py-3">供應商名稱</th>
              <th className="px-4 py-3">聯絡人</th>
              <th className="px-4 py-3">電話</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                <td className="px-4 py-3.5 font-mono text-xs text-neutral-800">{s.code}</td>
                <td className="px-4 py-3.5 font-medium text-neutral-900">{s.name}</td>
                <td className="px-4 py-3.5 text-neutral-700">{s.contactPerson}</td>
                <td className="px-4 py-3.5 tabular-nums text-neutral-700">{s.phone}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                      s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {s.status === 'ACTIVE' ? '啟用' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                      aria-label="編輯"
                      onClick={() => openEdit(s)}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="刪除"
                      onClick={async () => {
                        if (!confirm('確定刪除？')) return;
                        await deleteSupplier(s.id);
                        showToast('已刪除', 'ok');
                        load();
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!listLoading && !listError && rows.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">尚無供應商，請先新增供應商。</div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{editing ? '編輯供應商' : '新增供應商'}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextInput label="供應商編號 *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <TextInput label="名稱 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextInput label="聯絡人 *" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              <TextInput label="電話" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <TextInput label="地址" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <TextInput label="統編" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">付款條件</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <TextInput label="銀行帳號" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-neutral-700">備註</label>
                <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">狀態</label>
                <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}>
                  <option value="ACTIVE">啟用</option>
                  <option value="INACTIVE">停用</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                取消
              </Button>
              <Button type="button" variant="primary" onClick={save}>
                儲存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
