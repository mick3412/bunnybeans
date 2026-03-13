import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';

export const AdminCategoriesPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [rows, setRows] = useState<CategoryDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    const r = await getCategories();
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
    setOk(null);
    const out = await createCategory({ code: code.trim(), name: name.trim() });
    if (!('id' in out)) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    setCode('');
    setName('');
    setOk('已新增分類');
    showToast('已新增分類');
    await load();
  };

  const startEdit = (c: CategoryDto) => {
    setEditId(c.id);
    setEditCode(c.code);
    setEditName(c.name);
    setOk(null);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setErr(null);
    setOk(null);
    const out = await updateCategory(editId, {
      code: editCode.trim(),
      name: editName.trim(),
    });
    if (!('id' in out)) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    setEditId(null);
    setOk('已更新');
    showToast('已更新分類');
    await load();
  };

  const handleDelete = async (c: CategoryDto) => {
    if (!confirm(`確定刪除分類「${c.name}」？`)) return;
    setErr(null);
    setOk(null);
    const out = await deleteCategory(c.id);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    setOk('已刪除');
    showToast('已刪除分類');
    if (editId === c.id) setEditId(null);
    await load();
  };

  const field = 'h-9 rounded border border-slate-200 px-2 text-sm';

  return (
    <div className="max-w-3xl" data-testid="e2e-admin-categories">
      <h1 className="mb-2 text-xl font-bold text-slate-900">分類維護</h1>
      <p className="mb-4 text-sm text-slate-500">
        POST／PATCH／DELETE <code className="rounded bg-slate-100 px-1">/categories</code>
        需與後端 <code className="rounded bg-slate-100 px-1">ADMIN_API_KEY</code> 一致時帶{' '}
        <strong>X-Admin-Key</strong>（本機設 <code className="rounded bg-slate-100 px-1">VITE_ADMIN_API_KEY</code>
        ）。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">新增分類</div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={`${field} w-36`}
            placeholder="代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className={`${field} min-w-[180px] flex-1`}
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
              <th className="w-44 px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                {editId === c.id ? (
                  <>
                    <td className="px-4 py-2 align-middle">
                      <input
                        className={`${field} w-full min-w-0`}
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <input
                        className={`${field} w-full min-w-0`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-middle font-mono text-[10px] text-slate-500">
                      {c.id}
                    </td>
                    <td className="px-4 py-2 align-middle whitespace-nowrap">
                      <Button type="button" size="sm" variant="primary" onClick={() => void saveEdit()}>
                        儲存
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditId(null)}>
                        取消
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium">{c.code}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{c.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(c)}>
                        編輯
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleDelete(c)}
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
        {rows.length === 0 && !err && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">尚無分類</div>
        )}
      </div>
    </div>
  );
};
