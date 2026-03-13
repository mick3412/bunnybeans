import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  listMerchants,
  listStores,
  type WarehouseDto,
  type MerchantDto,
  type StoreDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminWarehousesPage: React.FC = () => {
  const [merchants, setMerchants] = useState<MerchantDto[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [rows, setRows] = useState<WarehouseDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState('');
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
    const [m, st, w] = await Promise.all([listMerchants(), listStores(), getWarehouses()]);
    if (!Array.isArray(m)) {
      setErr(getErrorMessage(m as ApiError));
      return;
    }
    if (!Array.isArray(st)) {
      setErr(getErrorMessage(st as ApiError));
      return;
    }
    if (!Array.isArray(w)) {
      setErr(getErrorMessage(w as ApiError));
      return;
    }
    setMerchants(m);
    setStores(st);
    setRows(w);
    setMerchantId((prev) => prev || m[0]?.id || '');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const merchantName = (id: string) => merchants.find((x) => x.id === id)?.name ?? id.slice(0, 8);
  const storeName = (id: string | null | undefined) =>
    id ? stores.find((x) => x.id === id)?.name ?? '—' : '—';

  const handleCreate = async () => {
    if (!merchantId || !code.trim() || !name.trim()) {
      setErr('請選商家並填代碼與名稱');
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

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-xl font-bold text-slate-900">倉庫主檔</h1>
      <p className="mb-4 text-sm text-slate-500">CRUD；須指定商家；門市可選（對應後端 storeId）。</p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">新增倉庫</div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="h-9 rounded border border-slate-200 px-2 text-sm"
            value={merchantId}
            onChange={(e) => {
              setMerchantId(e.target.value);
              setStoreId('');
            }}
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 max-w-[200px] rounded border border-slate-200 px-2 text-sm"
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
          <input
            className="h-9 rounded border border-slate-200 px-2 text-sm"
            placeholder="代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="h-9 min-w-[180px] flex-1 rounded border border-slate-200 px-2 text-sm"
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
              <th className="px-4 py-2">商家</th>
              <th className="px-4 py-2">門市</th>
              <th className="px-4 py-2 w-44">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-slate-100">
                {editId === w.id ? (
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
                    <td className="px-4 py-2 text-slate-500">{merchantName(w.merchantId)}</td>
                    <td className="px-4 py-2">
                      <select
                        className="max-w-full rounded border border-slate-200 px-1 text-xs"
                        value={editStoreId}
                        onChange={(e) => setEditStoreId(e.target.value)}
                      >
                        <option value="">—</option>
                        {stores
                          .filter((s) => s.merchantId === w.merchantId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
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
                    <td className="px-4 py-2 font-medium">{w.code}</td>
                    <td className="px-4 py-2">{w.name}</td>
                    <td className="px-4 py-2 text-slate-600">{merchantName(w.merchantId)}</td>
                    <td className="px-4 py-2 text-slate-600">{storeName(w.storeId)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(w)}>
                        編輯
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleDelete(w.id)}
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
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">尚無倉庫</div>
        )}
      </div>
    </div>
  );
};
