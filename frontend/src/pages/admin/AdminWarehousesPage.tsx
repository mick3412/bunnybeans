import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  listStores,
  type WarehouseDto,
  type StoreDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';

export const AdminWarehousesPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const merchantId = useDefaultMerchantId();
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [rows, setRows] = useState<WarehouseDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [storeId, setStoreId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editStoreId, setEditStoreId] = useState('');

  const storesForMerchant = stores.filter((s) => s.merchantId === merchantId);

  const load = useCallback(async () => {
    setErr(null);
    const [st, w] = await Promise.all([listStores(), getWarehouses()]);
    if (!Array.isArray(st)) {
      setErr(getErrorMessage(st as ApiError));
      return;
    }
    if (!Array.isArray(w)) {
      setErr(getErrorMessage(w as ApiError));
      return;
    }
    setStores(st);
    setRows(w);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storeName = (id: string | null | undefined) =>
    id ? stores.find((x) => x.id === id)?.name ?? '—' : '—';

  const handleCreate = async () => {
    if (!merchantId || !code.trim() || !name.trim()) {
      setErr('請填代碼與名稱（若無商家請先 seed）');
      return;
    }
    setErr(null);
    const r = await createWarehouse({
      merchantId,
      code: code.trim(),
      name: name.trim(),
      storeId: storeId || null,
    });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setCode('');
    setName('');
    setStoreId('');
    await load();
  };

  const startEdit = (w: WarehouseDto) => {
    setEditId(w.id);
    setEditCode(w.code);
    setEditName(w.name);
    setEditStoreId(w.storeId ?? '');
  };

  const saveEdit = async () => {
    if (!editId) return;
    setErr(null);
    const r = await updateWarehouse(editId, {
      code: editCode.trim(),
      name: editName.trim(),
      storeId: editStoreId || null,
    });
    if (!('id' in r)) {
      setErr(getErrorMessage(r as ApiError));
      return;
    }
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此倉庫？（若有庫存異動引用可能失敗）')) return;
    setErr(null);
    const r = await deleteWarehouse(id);
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
      <H className="mb-2 text-xl font-bold text-content">倉庫</H>
      <p className="mb-4 text-sm text-muted">
        CRUD；商家自動使用預設；門市可選（對應後端 storeId）。
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
        <select
          className={`${fieldClass} max-w-[180px]`}
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">門市（可空）</option>
          {storesForMerchant.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
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
              <th className="min-w-[140px] px-4 py-2 font-medium">門市</th>
              <th className="w-32 px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-[#e2e8f0]">
                {editId === w.id ? (
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
                    <td className="px-4 py-2">
                      <select
                        className={`${fieldClass} w-full min-w-[140px]`}
                        value={editStoreId}
                        onChange={(e) => setEditStoreId(e.target.value)}
                        aria-label="綁定門市"
                      >
                        <option value="">不綁門市</option>
                        {stores
                          .filter((s) => s.merchantId === w.merchantId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}（{s.code}）
                            </option>
                          ))}
                      </select>
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
                    <td className="px-4 py-2 font-medium">{w.code}</td>
                    <td className="px-4 py-2 text-muted">{w.name}</td>
                    <td className="px-4 py-2 text-muted">{storeName(w.storeId)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(w)}>
                        編輯
                      </Button>
                      <Button type="button" size="sm" variant="secondary" className="ml-1" onClick={() => void handleDelete(w.id)}>
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
          <div className="px-4 py-8 text-center text-sm text-muted">尚無倉庫</div>
        )}
      </div>
    </div>
  );
};
