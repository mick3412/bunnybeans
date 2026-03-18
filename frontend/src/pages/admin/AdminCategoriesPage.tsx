import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  listProductTags,
  createProductTag,
  updateProductTag,
  deleteProductTag,
  type CategoryDto,
  type BrandDto,
  type ProductTagDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';

const fieldClass =
  'h-8 rounded-lg border border-[#e2e8f0] px-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20';

const cardClass = 'rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm';

type MasterRow = { id: string; code: string; name: string };

function isEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  return e.key === 'Enter';
}

function MasterSection(props: {
  title: string;
  hint?: React.ReactNode;
  err: string | null;
  create: {
    code: string;
    name: string;
    setCode: (v: string) => void;
    setName: (v: string) => void;
    onCreate: () => void;
    codePlaceholder?: string;
    namePlaceholder?: string;
  };
  rows: MasterRow[];
  editingId: string | null;
  edit: {
    code: string;
    name: string;
    setCode: (v: string) => void;
    setName: (v: string) => void;
    onStartEdit: (row: MasterRow) => void;
    onSave: () => void;
    onCancel: () => void;
  };
  onDelete: (row: MasterRow) => void;
  emptyText: string;
  testId?: string;
}) {
  const {
    title,
    hint,
    err,
    create,
    rows,
    editingId,
    edit,
    onDelete,
    emptyText,
    testId,
  } = props;

  return (
    <div className={cardClass} data-testid={testId}>
      <h3 className="mb-3 text-sm font-semibold text-[#1e293b]">{title}</h3>
      {hint}
      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${fieldClass} w-20`}
          placeholder={create.codePlaceholder ?? '代碼'}
          value={create.code}
          onChange={(e) => create.setCode(e.target.value)}
          onKeyDown={(e) => isEnter(e) && create.onCreate()}
        />
        <input
          className={`${fieldClass} min-w-[100px] flex-1`}
          placeholder={create.namePlaceholder ?? '名稱'}
          value={create.name}
          onChange={(e) => create.setName(e.target.value)}
          onKeyDown={(e) => isEnter(e) && create.onCreate()}
        />
        <Button type="button" size="sm" variant="primary" onClick={() => create.onCreate()}>
          新增
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-[#e2e8f0]">
        <ul className="divide-y divide-[#e2e8f0] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              {editingId === r.id ? (
                <>
                  <div className="flex flex-1 flex-wrap gap-1">
                    <input
                      className={`${fieldClass} w-16`}
                      value={edit.code}
                      onChange={(e) => edit.setCode(e.target.value)}
                      onKeyDown={(e) => isEnter(e) && edit.onSave()}
                    />
                    <input
                      className={`${fieldClass} min-w-[80px] flex-1`}
                      value={edit.name}
                      onChange={(e) => edit.setName(e.target.value)}
                      onKeyDown={(e) => isEnter(e) && edit.onSave()}
                    />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="primary" onClick={() => edit.onSave()}>
                      儲存
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => edit.onCancel()}>
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="truncate font-medium">{r.code}</span>
                  <span className="truncate text-[#64748b]">{r.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => edit.onStartEdit(r)}>
                      編輯
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => onDelete(r)}>
                      刪除
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {rows.length === 0 && !err && (
          <div className="px-4 py-6 text-center text-sm text-[#64748b]">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export const AdminCategoriesPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const [tagMaster, setTagMaster] = useState<ProductTagDto[]>([]);
  const [tagErr, setTagErr] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCode, setNewTagCode] = useState('');
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditCode, setTagEditCode] = useState('');

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catEditCode, setCatEditCode] = useState('');
  const [catEditName, setCatEditName] = useState('');

  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [brandErr, setBrandErr] = useState<string | null>(null);
  const [brandCode, setBrandCode] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandEditId, setBrandEditId] = useState<string | null>(null);
  const [brandEditCode, setBrandEditCode] = useState('');
  const [brandEditName, setBrandEditName] = useState('');

  const loadCategories = useCallback(async () => {
    setCatErr(null);
    const r = await getCategories();
    if (!Array.isArray(r)) setCatErr(getErrorMessage(r as ApiError));
    else setCategories(r);
  }, []);

  const loadBrands = useCallback(async () => {
    setBrandErr(null);
    const r = await getBrands();
    if (!Array.isArray(r)) setBrandErr(getErrorMessage(r as ApiError));
    else setBrands(r);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const handleCreateCategory = async () => {
    if (!catCode.trim() || !catName.trim()) {
      setCatErr('請填代碼與名稱');
      return;
    }
    setCatErr(null);
    const out = await createCategory({ code: catCode.trim(), name: catName.trim() });
    if (!('id' in out)) {
      setCatErr(getErrorMessage(out as ApiError));
      return;
    }
    setCatCode('');
    setCatName('');
    showToast('已新增類別');
    await loadCategories();
  };

  const startEditCategory = (c: CategoryDto) => {
    setCatEditId(c.id);
    setCatEditCode(c.code);
    setCatEditName(c.name);
  };

  const saveEditCategory = async () => {
    if (!catEditId) return;
    setCatErr(null);
    const out = await updateCategory(catEditId, {
      code: catEditCode.trim(),
      name: catEditName.trim(),
    });
    if (!('id' in out)) {
      setCatErr(getErrorMessage(out as ApiError));
      return;
    }
    setCatEditId(null);
    showToast('已更新類別');
    await loadCategories();
  };

  const handleDeleteCategory = async (c: CategoryDto) => {
    if (!confirm(`確定刪除類別「${c.name}」？`)) return;
    setCatErr(null);
    const out = await deleteCategory(c.id);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setCatErr(getErrorMessage(out as ApiError));
      return;
    }
    showToast('已刪除類別');
    if (catEditId === c.id) setCatEditId(null);
    await loadCategories();
  };

  const handleCreateBrand = async () => {
    if (!brandCode.trim() || !brandName.trim()) {
      setBrandErr('請填代碼與名稱');
      return;
    }
    setBrandErr(null);
    const out = await createBrand({ code: brandCode.trim(), name: brandName.trim() });
    if (!('id' in out)) {
      setBrandErr(getErrorMessage(out as ApiError));
      return;
    }
    setBrandCode('');
    setBrandName('');
    showToast('已新增品牌');
    await loadBrands();
  };

  const startEditBrand = (b: BrandDto) => {
    setBrandEditId(b.id);
    setBrandEditCode(b.code);
    setBrandEditName(b.name);
  };

  const saveEditBrand = async () => {
    if (!brandEditId) return;
    setBrandErr(null);
    const out = await updateBrand(brandEditId, {
      code: brandEditCode.trim(),
      name: brandEditName.trim(),
    });
    if (!('id' in out)) {
      setBrandErr(getErrorMessage(out as ApiError));
      return;
    }
    setBrandEditId(null);
    showToast('已更新品牌');
    await loadBrands();
  };

  const handleDeleteBrand = async (b: BrandDto) => {
    if (!confirm(`確定刪除品牌「${b.name}」？`)) return;
    setBrandErr(null);
    const out = await deleteBrand(b.id);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setBrandErr(getErrorMessage(out as ApiError));
      return;
    }
    showToast('已刪除品牌');
    if (brandEditId === b.id) setBrandEditId(null);
    await loadBrands();
  };

  const loadTags = useCallback(async () => {
    if (!merchantId) return;
    setTagErr(null);
    const out = await listProductTags(merchantId);
    setTagMaster(Array.isArray(out) ? out : []);
    if (!Array.isArray(out)) setTagErr(getErrorMessage(out as ApiError));
  }, [merchantId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const code = newTagCode.trim() || name;
    if (!merchantId) return;
    setTagErr(null);
    const out = await createProductTag(merchantId, { name, code });
    if (!('id' in out)) {
      setTagErr(getErrorMessage(out as ApiError));
      return;
    }
    setNewTagName('');
    setNewTagCode('');
    showToast('已新增標籤');
    await loadTags();
  };

  const startEditTag = (t: ProductTagDto) => {
    setTagEditId(t.id);
    setTagEditName(t.name);
    setTagEditCode(t.code ?? t.name);
  };

  const saveEditTag = async () => {
    if (!tagEditId) return;
    const name = tagEditName.trim();
    if (!name) return;
    setTagErr(null);
    const out = await updateProductTag(tagEditId, {
      name,
      code: tagEditCode.trim() || name,
    });
    if (!('id' in out)) {
      setTagErr(getErrorMessage(out as ApiError));
      return;
    }
    setTagEditId(null);
    showToast('已更新標籤');
    await loadTags();
  };

  const deleteTag = async (t: ProductTagDto) => {
    if (!confirm(`確定刪除標籤「${t.name}」？`)) return;
    setTagErr(null);
    const out = await deleteProductTag(t.id);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setTagErr(getErrorMessage(out as ApiError));
      return;
    }
    if (tagEditId === t.id) setTagEditId(null);
    showToast('已刪除標籤');
    await loadTags();
  };

  return (
    <div className="mx-auto max-w-6xl" data-testid="e2e-admin-categories">
      <div className="mb-4 text-xs text-[#64748b]">
        寫入需 <code className="rounded bg-[#f1f5f9] px-1">X-Admin-Key</code>（
        <code className="rounded bg-[#f1f5f9] px-1">VITE_ADMIN_API_KEY</code>）。標籤由 GET/POST/PATCH/DELETE /product-tags 管理。
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MasterSection
          title="品項"
          err={catErr}
          create={{
            code: catCode,
            name: catName,
            setCode: setCatCode,
            setName: setCatName,
            onCreate: () => void handleCreateCategory(),
          }}
          rows={categories.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          editingId={catEditId}
          edit={{
            code: catEditCode,
            name: catEditName,
            setCode: setCatEditCode,
            setName: setCatEditName,
            onStartEdit: (r) => startEditCategory({ id: r.id, code: r.code, name: r.name }),
            onSave: () => void saveEditCategory(),
            onCancel: () => setCatEditId(null),
          }}
          onDelete={(r) => void handleDeleteCategory({ id: r.id, code: r.code, name: r.name })}
          emptyText="尚無類別"
        />

        <MasterSection
          title="品牌"
          err={brandErr}
          create={{
            code: brandCode,
            name: brandName,
            setCode: setBrandCode,
            setName: setBrandName,
            onCreate: () => void handleCreateBrand(),
          }}
          rows={brands.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
          editingId={brandEditId}
          edit={{
            code: brandEditCode,
            name: brandEditName,
            setCode: setBrandEditCode,
            setName: setBrandEditName,
            onStartEdit: (r) => startEditBrand({ id: r.id, code: r.code, name: r.name }),
            onSave: () => void saveEditBrand(),
            onCancel: () => setBrandEditId(null),
          }}
          onDelete={(r) => void handleDeleteBrand({ id: r.id, code: r.code, name: r.name })}
          emptyText="尚無品牌"
        />

        <MasterSection
          title="標籤"
          testId="e2e-admin-categories-tags"
          hint={
            <p className="mb-2 text-xs text-[#64748b]">
              與商品標籤共用；由 GET/POST/PATCH/DELETE /product-tags 管理。
            </p>
          }
          err={tagErr}
          create={{
            code: newTagCode,
            name: newTagName,
            setCode: setNewTagCode,
            setName: setNewTagName,
            onCreate: () => void addTag(),
            namePlaceholder: '名稱',
            codePlaceholder: '代碼（可選）',
          }}
          rows={tagMaster.map((t) => ({ id: t.id, code: t.code ?? t.name, name: t.name }))}
          editingId={tagEditId}
          edit={{
            code: tagEditCode,
            name: tagEditName,
            setCode: setTagEditCode,
            setName: setTagEditName,
            onStartEdit: (r) =>
              startEditTag({
                id: r.id,
                name: r.name,
                code: r.code,
              } as ProductTagDto),
            onSave: () => void saveEditTag(),
            onCancel: () => setTagEditId(null),
          }}
          onDelete={(r) =>
            void deleteTag({
              id: r.id,
              name: r.name,
              code: r.code,
            } as ProductTagDto)
          }
          emptyText="尚無標籤"
        />
      </div>
    </div>
  );
};
