import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  listStores,
  createStore,
  updateStore,
  deleteStore,
  type StoreDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';

export const AdminStoresPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const merchantId = useDefaultMerchantId();
  const [rows, setRows] = useState<StoreDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    const s = await listStores();
    if (!Array.isArray(s)) {
      setErr(getErrorMessage(s as ApiError));
      return;
    }
    setRows(s);
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
  const fieldClass = 'h-9 rounded-lg border border-[#e2e8f0] px-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20';
  return (
    <div className={embedded ? '' : 'mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm'}>
      <H className="mb-2 text-xl font-bold text-content">門市</H>
      <p className="mb-4 text-sm text-muted">
        CRUD；所屬商家自動使用系統預設（單一商家情境，不顯示商家選單）。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={`${fieldClass} w-24`}
          placeholder="代碼"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className={`${fieldClass} min-w-[140px] flex-1`}
          placeholder="名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" size="sm" variant="primary" onClick={() => void handleCreate()}>
          新增
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">代碼</th>
              <th className="px-4 py-2 font-medium">名稱</th>
              <th className="w-32 px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-[#e2e8f0]">
                {editId === s.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        className={`${fieldClass} w-full`}
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className={`${fieldClass} w-full`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button type="button" size="sm" variant="primary" onClick={() => void saveEdit()}>
                        儲存
                      </Button>
                      <Button type="button" size="sm" variant="secondary" className="ml-1" onClick={() => setEditId(null)}>
                        取消
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium">{s.code}</td>
                    <td className="px-4 py-2 text-muted">{s.name}</td>
                    <td className="px-4 py-2 text-right">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(s)}>
                        編輯
                      </Button>
                      <Button type="button" size="sm" variant="secondary" className="ml-1" onClick={() => void handleDelete(s.id)}>
                        刪除
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">尚無門市</div>
        )}
      </div>
    </div>
  );
};
