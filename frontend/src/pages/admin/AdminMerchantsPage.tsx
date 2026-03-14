import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  listMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  type MerchantDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminMerchantsPage: React.FC = () => {
  const [rows, setRows] = useState<MerchantDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    const r = await listMerchants();
    if (!Array.isArray(r)) setErr(getErrorMessage(r as ApiError));
    else setRows(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      setErr('請填代碼與名稱');
      return;
    }
    setErr(null);
    const r = await createMerchant({ code: code.trim(), name: name.trim() });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setCode('');
    setName('');
    await load();
  };

  const startEdit = (m: MerchantDto) => {
    setEditId(m.id);
    setEditCode(m.code);
    setEditName(m.name);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setErr(null);
    const r = await updateMerchant(editId, { code: editCode.trim(), name: editName.trim() });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此商家？（若門市／倉庫仍引用可能失敗）')) return;
    setErr(null);
    const r = await deleteMerchant(id);
    if (r && typeof r === 'object' && 'statusCode' in r) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    await load();
  };

  return (
    <div className="max-w-4xl">
      <p className="mb-4 text-sm text-slate-600">CRUD；代碼須唯一。</p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">新增商家</div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className="h-9 rounded border border-slate-200 px-2 text-sm"
            placeholder="代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="h-9 min-w-[200px] flex-1 rounded border border-slate-200 px-2 text-sm"
            placeholder="名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              <th className="px-4 py-2">代碼</th>
              <th className="px-4 py-2">名稱</th>
              <th className="px-4 py-2 font-mono text-xs">ID</th>
              <th className="px-4 py-2 w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                {editId === m.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded border border-slate-200 px-1 text-sm"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded border border-slate-200 px-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{m.id}</td>
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
                    <td className="px-4 py-2 font-medium">{m.code}</td>
                    <td className="px-4 py-2">{m.name}</td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{m.id}</td>
                    <td className="px-4 py-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(m)}>
                        編輯
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="ml-1 text-red-700"
                        onClick={() => void handleDelete(m.id)}
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
