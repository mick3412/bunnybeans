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
  'h-8 rounded-lg border border-brand-surface px-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';

const cardClass = 'rounded-xl border border-brand-surface bg-white p-4 shadow-sm';

type MasterRow = { id: string; code: string; name: string };

function isEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  return e.key === 'Enter';
}

function slugifyLoose(input: string): string {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return '';
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  if (ascii) return ascii;
  // 中文/非拉丁字元：使用穩定短碼（仍限制為 a-z0-9-）
  let h = 0;
  for (const ch of raw) h = (h * 131 + ch.codePointAt(0)!) >>> 0;
  return `x-${h.toString(36)}`;
}

function dedupeCode(base: string, used: Set<string>): string {
  const b = base.trim();
  if (!b) return '';
  if (!used.has(b)) return b;
  for (let i = 2; i < 10_000; i += 1) {
    const cand = `${b}-${i}`;
    if (!used.has(cand)) return cand;
  }
  return `${b}-${Date.now()}`;
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
          data-testid={testId ? `${testId}-create-code-input` : undefined}
        />
        <input
          className={`${fieldClass} min-w-[100px] flex-1`}
          placeholder={create.namePlaceholder ?? '名稱'}
          value={create.name}
          onChange={(e) => create.setName(e.target.value)}
          onKeyDown={(e) => isEnter(e) && create.onCreate()}
          data-testid={testId ? `${testId}-create-name-input` : undefined}
        />
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => create.onCreate()}
          data-testid={testId ? `${testId}-create-add-btn` : undefined}
        >
          新增
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-brand-surface">
        <ul className="divide-y divide-brand-surface text-sm">
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
                      data-testid={testId ? `${testId}-edit-code-input` : undefined}
                    />
                    <input
                      className={`${fieldClass} min-w-[80px] flex-1`}
                      value={edit.name}
                      onChange={(e) => edit.setName(e.target.value)}
                      onKeyDown={(e) => isEnter(e) && edit.onSave()}
                      data-testid={testId ? `${testId}-edit-name-input` : undefined}
                    />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => edit.onSave()}
                      data-testid={testId ? `${testId}-edit-save-btn` : undefined}
                    >
                      儲存
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => edit.onCancel()}
                      data-testid={testId ? `${testId}-edit-cancel-btn` : undefined}
                    >
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="truncate font-medium">{r.code}</span>
                  <span className="truncate text-[#64748b]">{r.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => edit.onStartEdit(r)}
                      data-testid={testId ? `${testId}-row-edit-btn` : undefined}
                    >
                      編輯
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onDelete(r)}
                      data-testid={testId ? `${testId}-row-delete-btn` : undefined}
                    >
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
  const [catCodeTouched, setCatCodeTouched] = useState(false);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catEditCode, setCatEditCode] = useState('');
  const [catEditName, setCatEditName] = useState('');
  const [catEditCodeTouched, setCatEditCodeTouched] = useState(false);

  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [brandErr, setBrandErr] = useState<string | null>(null);
  const [brandCode, setBrandCode] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandCodeTouched, setBrandCodeTouched] = useState(false);
  const [brandEditId, setBrandEditId] = useState<string | null>(null);
  const [brandEditCode, setBrandEditCode] = useState('');
  const [brandEditName, setBrandEditName] = useState('');
  const [brandEditCodeTouched, setBrandEditCodeTouched] = useState(false);

  const [tagCodeTouched, setTagCodeTouched] = useState(false);
  const [tagEditCodeTouched, setTagEditCodeTouched] = useState(false);

  const usedCategoryCodes = new Set(categories.map((c) => String(c.code ?? '').trim()).filter(Boolean));
  const usedBrandCodes = new Set(brands.map((b) => String(b.code ?? '').trim()).filter(Boolean));
  const usedTagCodes = new Set(tagMaster.map((t) => String(t.code ?? '').trim()).filter(Boolean));

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
    const name = catName.trim();
    if (!name) {
      setCatErr('缺少名稱');
      return;
    }
    const base = catCodeTouched ? catCode.trim() : catCode.trim() || slugifyLoose(name);
    const code = dedupeCode(base, usedCategoryCodes);
    if (!code) {
      setCatErr('缺少代碼');
      return;
    }
    setCatErr(null);
    const out = await createCategory({ code, name });
    if (!('id' in out)) {
      setCatErr(getErrorMessage(out as ApiError));
      return;
    }
    setCatCode('');
    setCatName('');
    setCatCodeTouched(false);
    showToast('已新增類別');
    await loadCategories();
  };

  const startEditCategory = (c: CategoryDto) => {
    setCatEditId(c.id);
    setCatEditCode(c.code);
    setCatEditName(c.name);
    setCatEditCodeTouched(false);
  };

  const saveEditCategory = async () => {
    if (!catEditId) return;
    const name = catEditName.trim();
    const used = new Set(
      categories
        .filter((c) => c.id !== catEditId)
        .map((c) => String(c.code ?? '').trim())
        .filter(Boolean),
    );
    const base = catEditCodeTouched ? catEditCode.trim() : catEditCode.trim() || slugifyLoose(name);
    const code = dedupeCode(base, used);
    if (!code || !name) {
      setCatErr('缺少代碼或名稱');
      return;
    }
    setCatErr(null);
    const out = await updateCategory(catEditId, {
      code,
      name,
    });
    if (!('id' in out)) {
      setCatErr(getErrorMessage(out as ApiError));
      return;
    }
    setCatEditId(null);
    setCatEditCodeTouched(false);
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

  useEffect(() => {
    const name = catName.trim();
    if (!name) return;
    if (catCodeTouched) return;
    const next = dedupeCode(slugifyLoose(name), usedCategoryCodes);
    if (next && next !== catCode) setCatCode(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catName, catCodeTouched]);

  useEffect(() => {
    if (!catEditId) return;
    const name = catEditName.trim();
    if (!name) return;
    if (catEditCodeTouched) return;
    const used = new Set(
      categories
        .filter((c) => c.id !== catEditId)
        .map((c) => String(c.code ?? '').trim())
        .filter(Boolean),
    );
    const next = dedupeCode(slugifyLoose(name), used);
    if (next && next !== catEditCode) setCatEditCode(next);
  }, [catEditId, catEditName, catEditCodeTouched, categories, catEditCode]);

  const handleCreateBrand = async () => {
    const name = brandName.trim();
    if (!name) {
      setBrandErr('缺少名稱');
      return;
    }
    const base = brandCodeTouched ? brandCode.trim() : brandCode.trim() || slugifyLoose(name);
    const code = dedupeCode(base, usedBrandCodes);
    if (!code) {
      setBrandErr('缺少代碼');
      return;
    }
    setBrandErr(null);
    const out = await createBrand({ code, name });
    if (!('id' in out)) {
      setBrandErr(getErrorMessage(out as ApiError));
      return;
    }
    setBrandCode('');
    setBrandName('');
    setBrandCodeTouched(false);
    showToast('已新增品牌');
    await loadBrands();
  };

  const startEditBrand = (b: BrandDto) => {
    setBrandEditId(b.id);
    setBrandEditCode(b.code);
    setBrandEditName(b.name);
    setBrandEditCodeTouched(false);
  };

  const saveEditBrand = async () => {
    if (!brandEditId) return;
    const name = brandEditName.trim();
    const used = new Set(
      brands
        .filter((b) => b.id !== brandEditId)
        .map((b) => String(b.code ?? '').trim())
        .filter(Boolean),
    );
    const base = brandEditCodeTouched ? brandEditCode.trim() : brandEditCode.trim() || slugifyLoose(name);
    const code = dedupeCode(base, used);
    if (!code || !name) {
      setBrandErr('缺少代碼或名稱');
      return;
    }
    setBrandErr(null);
    const out = await updateBrand(brandEditId, {
      code,
      name,
    });
    if (!('id' in out)) {
      setBrandErr(getErrorMessage(out as ApiError));
      return;
    }
    setBrandEditId(null);
    setBrandEditCodeTouched(false);
    showToast('已更新品牌');
    await loadBrands();
  };

  useEffect(() => {
    const name = brandName.trim();
    if (!name) return;
    if (brandCodeTouched) return;
    const next = dedupeCode(slugifyLoose(name), usedBrandCodes);
    if (next && next !== brandCode) setBrandCode(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, brandCodeTouched]);

  useEffect(() => {
    if (!brandEditId) return;
    const name = brandEditName.trim();
    if (!name) return;
    if (brandEditCodeTouched) return;
    const used = new Set(
      brands
        .filter((b) => b.id !== brandEditId)
        .map((b) => String(b.code ?? '').trim())
        .filter(Boolean),
    );
    const next = dedupeCode(slugifyLoose(name), used);
    if (next && next !== brandEditCode) setBrandEditCode(next);
  }, [brandEditId, brandEditName, brandEditCodeTouched, brands, brandEditCode]);

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
    if (!name) {
      setTagErr('缺少名稱');
      return;
    }
    if (!merchantId) return;
    const base = tagCodeTouched ? newTagCode.trim() : newTagCode.trim() || slugifyLoose(name);
    const code = base ? dedupeCode(base, usedTagCodes) : '';
    setTagErr(null);
    const out = await createProductTag(merchantId, { name, code: code || null });
    if (!('id' in out)) {
      setTagErr(getErrorMessage(out as ApiError));
      return;
    }
    setNewTagName('');
    setNewTagCode('');
    setTagCodeTouched(false);
    showToast('已新增標籤');
    await loadTags();
  };

  const startEditTag = (t: ProductTagDto) => {
    setTagEditId(t.id);
    setTagEditName(t.name);
    setTagEditCode(t.code ?? '');
    setTagEditCodeTouched(false);
  };

  const saveEditTag = async () => {
    if (!tagEditId) return;
    const name = tagEditName.trim();
    if (!name) {
      setTagErr('缺少名稱');
      return;
    }
    const used = new Set(
      tagMaster
        .filter((t) => t.id !== tagEditId)
        .map((t) => String(t.code ?? '').trim())
        .filter(Boolean),
    );
    const base = tagEditCodeTouched ? tagEditCode.trim() : tagEditCode.trim() || slugifyLoose(name);
    const code = base ? dedupeCode(base, used) : '';
    setTagErr(null);
    const out = await updateProductTag(tagEditId, {
      name,
      code: code || name,
    });
    if (!('id' in out)) {
      setTagErr(getErrorMessage(out as ApiError));
      return;
    }
    setTagEditId(null);
    setTagEditCodeTouched(false);
    showToast('已更新標籤');
    await loadTags();
  };

  useEffect(() => {
    const name = newTagName.trim();
    if (!name) return;
    if (tagCodeTouched) return;
    const next = dedupeCode(slugifyLoose(name), usedTagCodes);
    if (next && next !== newTagCode) setNewTagCode(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTagName, tagCodeTouched]);

  useEffect(() => {
    if (!tagEditId) return;
    const name = tagEditName.trim();
    if (!name) return;
    if (tagEditCodeTouched) return;
    const used = new Set(
      tagMaster
        .filter((t) => t.id !== tagEditId)
        .map((t) => String(t.code ?? '').trim())
        .filter(Boolean),
    );
    const next = dedupeCode(slugifyLoose(name), used);
    if (next && next !== tagEditCode) setTagEditCode(next);
  }, [tagEditId, tagEditName, tagEditCodeTouched, tagMaster, tagEditCode]);

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MasterSection
          title="品項"
          testId="e2e-admin-categories-categories"
          err={catErr}
          create={{
            code: catCode,
            name: catName,
            setCode: (v) => {
              setCatCode(v);
              setCatCodeTouched(true);
            },
            setName: setCatName,
            onCreate: () => void handleCreateCategory(),
          }}
          rows={categories.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          editingId={catEditId}
          edit={{
            code: catEditCode,
            name: catEditName,
            setCode: (v) => {
              setCatEditCode(v);
              setCatEditCodeTouched(true);
            },
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
          testId="e2e-admin-categories-brands"
          err={brandErr}
          create={{
            code: brandCode,
            name: brandName,
            setCode: (v) => {
              setBrandCode(v);
              setBrandCodeTouched(true);
            },
            setName: setBrandName,
            onCreate: () => void handleCreateBrand(),
          }}
          rows={brands.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
          editingId={brandEditId}
          edit={{
            code: brandEditCode,
            name: brandEditName,
            setCode: (v) => {
              setBrandEditCode(v);
              setBrandEditCodeTouched(true);
            },
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
          err={tagErr}
          create={{
            code: newTagCode,
            name: newTagName,
            setCode: (v) => {
              setNewTagCode(v);
              setTagCodeTouched(true);
            },
            setName: setNewTagName,
            onCreate: () => void addTag(),
            namePlaceholder: '名稱',
            codePlaceholder: '代碼',
          }}
          rows={tagMaster.map((t) => ({ id: t.id, code: t.code ?? t.name, name: t.name }))}
          editingId={tagEditId}
          edit={{
            code: tagEditCode,
            name: tagEditName,
            setCode: (v) => {
              setTagEditCode(v);
              setTagEditCodeTouched(true);
            },
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
