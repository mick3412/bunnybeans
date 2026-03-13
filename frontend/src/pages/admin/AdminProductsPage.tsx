import React, { useEffect, useState } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getBrands,
  type ProductFullDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { TextInput } from '../../shared/components/TextInput';

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductFullDto[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductFullDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    categoryId: '',
    brandId: '',
    tags: '',
  });

  const load = async () => {
    setErr(null);
    const [p, c, b] = await Promise.all([getProducts(), getCategories(), getBrands()]);
    if (!Array.isArray(p)) {
      setErr(getErrorMessage(p as ApiError));
      return;
    }
    setProducts(p);
    if (Array.isArray(c)) setCategories(c);
    if (Array.isArray(b)) setBrands(b);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ sku: '', name: '', categoryId: '', brandId: '', tags: '' });
  };

  const openEdit = (row: ProductFullDto) => {
    setEditing(row);
    setCreating(false);
    setForm({
      sku: row.sku,
      name: row.name,
      categoryId: row.categoryId ?? '',
      brandId: row.brandId ?? '',
      tags: (row.tags ?? []).join(', '),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const tags = form.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const body = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      brandId: form.brandId || null,
      tags,
    };
    if (creating) {
      const out = await createProduct(body);
      if ('statusCode' in out) {
        setErr(getErrorMessage(out as ApiError));
        return;
      }
    } else if (editing) {
      const out = await updateProduct(editing.id, {
        sku: body.sku,
        name: body.name,
        categoryId: body.categoryId,
        brandId: body.brandId,
        tags,
      });
      if ('statusCode' in out) {
        setErr(getErrorMessage(out as ApiError));
        return;
      }
    }
    setCreating(false);
    setEditing(null);
    await load();
  };

  const onDelete = async (id: string) => {
    if (!confirm('確定刪除此商品？（若有庫存事件請先確認）')) return;
    const out = await deleteProduct(id);
    if ('statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    await load();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">商品主檔</h1>
          <p className="text-sm text-slate-500">與 POS 共用主檔 API</p>
        </div>
        <Button type="button" onClick={openCreate}>
          新增商品
        </Button>
      </div>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {(creating || editing) && (
        <form
          onSubmit={submit}
          className="mb-6 rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3"
        >
          <div className="text-sm font-semibold text-violet-900">
            {creating ? '新增商品' : `編輯：${editing?.sku}`}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              required
            />
            <TextInput
              label="名稱"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">分類</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">品牌</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.brandId}
                onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
              >
                <option value="">—</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <TextInput
            label="標籤（逗號分隔）"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="促銷中, 熱賣"
          />
          <div className="flex gap-2">
            <Button type="submit">儲存</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">名稱</th>
              <th className="px-4 py-2">標籤</th>
              <th className="px-4 py-2 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{(p.tags ?? []).join(', ')}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="mr-2 text-violet-600 text-xs font-medium hover:underline"
                    onClick={() => openEdit(p)}
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    className="text-red-600 text-xs font-medium hover:underline"
                    onClick={() => onDelete(p.id)}
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
