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
import { Alert } from '../../shared/components/Alert';
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
      setErr('缺少代碼或名稱');
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
  const fieldClass = 'h-9 rounded-lg border border-brand-surface px-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';
  return (
    <div className={embedded ? '' : 'mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm'}>
      <H className="mb-2 text-lg font-semibold text-content">門市</H>
      <p className="mb-4 text-sm text-muted">
        CRUD；所屬商家自動使用系統預設（單一商家情境，不顯示商家選單）。
      </p>
      {err && (
        <div className="mb-4">
          <Alert variant="error">{err}</Alert>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">代碼</label>
          <input
            className={`${fieldClass} w-24`}
            placeholder="代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">名稱</label>
          <input
            className={`${fieldClass} min-w-[140px]`}
            placeholder="名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" variant="primary" onClick={() => void handleCreate()}>
          新增
        </Button>
      </div>
      <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">代碼</th>
              <th className="px-4 py-2 font-medium">名稱</th>
              <th className="w-32 px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-brand-surface hover:bg-brand-canvas">
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
