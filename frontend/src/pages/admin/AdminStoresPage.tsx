import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  listMerchants,
  listStores,
  createStore,
  updateStore,
  deleteStore,
  type MerchantDto,
  type StoreDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminStoresPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [merchants, setMerchants] = useState<MerchantDto[]>([]);
  const [rows, setRows] = useState<StoreDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    const [m, s] = await Promise.all([listMerchants(), listStores()]);
    if (!Array.isArray(m)) {
      setErr(getErrorMessage(m as ApiError));
      return;
    }
    if (!Array.isArray(s)) {
      setErr(getErrorMessage(s as ApiError));
      return;
    }
    setMerchants(m);
    setRows(s);
    setMerchantId((prev) => (prev || (m[0]?.id ?? '')));
  }, []);

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!merchantId || !code.trim() || !name.trim()) {
      setErr('請填代碼與名稱（若無商家資料請先 seed）');
      return;
    }
    setErr(null);
    const r = await createStore({
      merchantId,
      code: code.trim(),
      name: name.trim(),
    });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setCode('');
    setName('');
    await load();
  };

  const startEdit = (s: StoreDto) => {
    setEditId(s.id);
    setEditCode(s.code);
    setEditName(s.name);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setErr(null);
    const r = await updateStore(editId, { code: editCode.trim(), name: editName.trim() });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此門市？')) return;
    setErr(null);
    const r = await deleteStore(id);
    if (r && typeof r === 'object' && 'statusCode' in r) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    await load();
  };

  const H = embedded ? 'h2' : 'h1';
  return (
    <div className={embedded ? '' : 'max-w-4xl'}>
      <H className="mb-2 text-xl font-bold text-slate-900">門市</H>
      <p className="mb-4 text-sm text-slate-500">
        CRUD；所屬商家自動使用系統預設（單一商家情境，不顯示商家選單）。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">新增門市</div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className="h-9 min-w-[180px] flex-1 rounded border border-slate-200 px-2 text-sm"
            placeholder="名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="h-9 rounded border border-slate-200 px-2 text-sm"
            placeholder="代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="button" size="sm" variant="primary" onClick={() => void handleCreate()}>
            新增
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2">名稱</th>
              <th className="px-4 py-2">代碼</th>
              <th className="px-4 py-2 font-mono text-xs">ID</th>
              <th className="px-4 py-2 w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                {editId === s.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded border border-slate-200 px-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded border border-slate-200 px-1 text-sm"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{s.id}</td>
                    <td className="px-4 py-2">
                      <Button type="button" size="sm" variant="primary" onClick={() => void saveEdit()}>
                        儲存
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="ml-1"
                        onClick={() => setEditId(null)}
                      >
                        取消
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2">{s.code}</td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{s.id}</td>
                    <td className="px-4 py-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(s)}>
                        編輯
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="ml-1 text-red-700"
                        onClick={() => void handleDelete(s.id)}
                      >
                        刪除
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
