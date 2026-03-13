import React, { useCallback, useEffect, useState } from 'react';
import { getCategories, type CategoryDto, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminCategoriesPage: React.FC = () => {
  const [rows, setRows] = useState<CategoryDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await getCategories();
    if (!Array.isArray(r)) setErr(getErrorMessage(r as ApiError));
    else setRows(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-xl font-bold text-slate-900">分類列表</h1>
      <p className="mb-4 text-sm text-slate-500">唯讀；寫入待後端 Category CRUD 對齊後再接。</p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2">代碼</th>
              <th className="px-4 py-2">名稱</th>
              <th className="px-4 py-2 font-mono text-xs">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{c.id}</td>
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
