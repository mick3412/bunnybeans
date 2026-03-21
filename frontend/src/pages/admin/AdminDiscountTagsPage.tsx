import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../shared/components/Alert';
import { Button } from '../../shared/components/Button';
import {
  listProductTags,
  createProductTag,
  updateProductTag,
  deleteProductTag,
  reorderProductTags,
  type ProductTagDto,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';

const CONDITION_TYPES = [
  { value: 'MANUAL', label: '僅手動' },
  { value: 'SALES_QTY', label: '銷量達門檻' },
  { value: 'DISCOUNT_RATIO', label: '有折扣' },
  { value: 'LOW_STOCK', label: '低庫存' },
  { value: 'NEW_ARRIVAL', label: '新上架' },
] as const;

function getConditionType(ac: ProductTagDto['autoCondition']): string {
  if (ac && typeof ac === 'object' && 'type' in ac) return String((ac as { type?: string }).type ?? 'MANUAL');
  return 'MANUAL';
}

function getConditionParams(ac: ProductTagDto['autoCondition']) {
  if (!ac || typeof ac !== 'object') return {};
  return ac as Record<string, number>;
}

export const AdminDiscountTagsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const [tags, setTags] = useState<ProductTagDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newShowInPos, setNewShowInPos] = useState(true);
  const [newConditionType, setNewConditionType] = useState<string>('MANUAL');
  const [newLookbackDays, setNewLookbackDays] = useState(30);
  const [newMinQty, setNewMinQty] = useState(10);
  const [newMinPercent, setNewMinPercent] = useState(5);
  const [newMaxQty, setNewMaxQty] = useState(3);
  const [newWithinDays, setNewWithinDays] = useState(30);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editShowInPos, setEditShowInPos] = useState(true);
  const [editConditionType, setEditConditionType] = useState<string>('MANUAL');
  const [editLookbackDays, setEditLookbackDays] = useState(30);
  const [editMinQty, setEditMinQty] = useState(10);
  const [editMinPercent, setEditMinPercent] = useState(5);
  const [editMaxQty, setEditMaxQty] = useState(3);
  const [editWithinDays, setEditWithinDays] = useState(30);

  const load = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    const out = await listProductTags(merchantId);
    setLoading(false);
    if (Array.isArray(out)) setTags(out);
    else setErr(getErrorMessage(out as ApiError));
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildAutoCondition = (type: string, params: Record<string, number>) => {
    if (type === 'MANUAL') return undefined;
    if (type === 'SALES_QTY') return { type, lookbackDays: params.lookbackDays ?? 30, minQty: params.minQty ?? 10 };
    if (type === 'DISCOUNT_RATIO') return { type, minPercent: params.minPercent ?? 5 };
    if (type === 'LOW_STOCK') return { type, maxQty: params.maxQty ?? 3 };
    if (type === 'NEW_ARRIVAL') return { type, withinDays: params.withinDays ?? 30 };
    return undefined;
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !merchantId) return;
    setErr(null);
    const autoCondition = buildAutoCondition(newConditionType, {
      lookbackDays: newLookbackDays,
      minQty: newMinQty,
      minPercent: newMinPercent,
      maxQty: newMaxQty,
      withinDays: newWithinDays,
    });
    const out = await createProductTag(merchantId, {
      name,
      showInPosDiscount: newShowInPos,
      autoCondition,
    });
    if (!('id' in out)) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    showToast('已新增折扣標籤');
    setNewName('');
    setNewShowInPos(true);
    setNewConditionType('MANUAL');
    void load();
  };

  const startEdit = (t: ProductTagDto) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditShowInPos(t.showInPosDiscount ?? true);
    const ct = getConditionType(t.autoCondition);
    setEditConditionType(ct);
    const p = getConditionParams(t.autoCondition);
    setEditLookbackDays(p.lookbackDays ?? 30);
    setEditMinQty(p.minQty ?? 10);
    setEditMinPercent(p.minPercent ?? 5);
    setEditMaxQty(p.maxQty ?? 3);
    setEditWithinDays(p.withinDays ?? 30);
  };

  const saveEdit = async () => {
    if (!editId || !merchantId) return;
    const name = editName.trim();
    if (!name) return;
    setErr(null);
    const autoCondition = buildAutoCondition(editConditionType, {
      lookbackDays: editLookbackDays,
      minQty: editMinQty,
      minPercent: editMinPercent,
      maxQty: editMaxQty,
      withinDays: editWithinDays,
    });
    const out = await updateProductTag(editId, {
      name,
      showInPosDiscount: editShowInPos,
      autoCondition,
    });
    if (!('id' in out)) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    showToast('已更新折扣標籤');
    setEditId(null);
    void load();
  };

  const handleDelete = async (t: ProductTagDto) => {
    if (!confirm(`確定刪除標籤「${t.name}」？`)) return;
    setErr(null);
    const out = await deleteProductTag(t.id);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    if (editId === t.id) setEditId(null);
    showToast('已刪除標籤');
    void load();
  };

  const handleReorder = async (ids: string[]) => {
    if (!merchantId) return;
    const out = await reorderProductTags(merchantId, ids);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out as ApiError));
      return;
    }
    showToast('已更新排序');
    void load();
  };

  const fieldClass = 'h-8 rounded-lg border border-brand-surface px-2 text-sm focus:border-brand-primary focus:outline-none';
  const labelClass = 'text-xs font-medium text-muted';

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="e2e-admin-discount-tags">
      <div>
        <h1 className="text-lg font-semibold text-content">折扣標籤設定</h1>
        <p className="mt-0.5 text-sm text-muted">
          設定哪些標籤顯示於 POS 收銀區的「折扣」篩選列，並可為每個標籤設定自動貼標條件（如熱銷＝銷量達門檻）。
        </p>
        <p className="mt-1 text-sm">
          <Link to="/admin/categories" className="font-medium text-brand-primary hover:underline">
            類別管理（品項／品牌／標籤）
          </Link>
        </p>
      </div>

      {err && (
        <Alert variant="error">{err}</Alert>
      )}

      {/* 新增 */}
      <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-content">新增標籤</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label className={labelClass}>名稱</label>
            <input
              type="text"
              className={`${fieldClass} mt-0.5 w-32`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="如：熱銷"
              data-testid="e2e-admin-discount-tags-create-name-input"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={newShowInPos}
                onChange={(e) => setNewShowInPos(e.target.checked)}
              />
              <span className={labelClass}>顯示於 POS 折扣篩選</span>
            </label>
          </div>
          <div>
            <label className={labelClass}>自動條件</label>
            <select
              className={`${fieldClass} mt-0.5 w-36`}
              value={newConditionType}
              onChange={(e) => setNewConditionType(e.target.value)}
            >
              {CONDITION_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {newConditionType === 'SALES_QTY' && (
            <>
              <div>
                <label className={labelClass}>回溯天數</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} mt-0.5 w-20`}
                    value={newLookbackDays}
                    onChange={(e) => setNewLookbackDays(Number(e.target.value) || 30)}
                  />
                  <span className="text-xs text-muted">天</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>最低銷量</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} mt-0.5 w-20`}
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(Number(e.target.value) || 1)}
                  />
                  <span className="text-xs text-muted">件</span>
                </div>
              </div>
            </>
          )}
          {newConditionType === 'DISCOUNT_RATIO' && (
            <div>
              <label className={labelClass}>最低折扣</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  className={`${fieldClass} mt-0.5 w-20`}
                  value={newMinPercent}
                  onChange={(e) => setNewMinPercent(Number(e.target.value) || 0)}
                />
                <span className="text-xs text-muted">%</span>
              </div>
            </div>
          )}
          {newConditionType === 'LOW_STOCK' && (
            <div>
              <label className={labelClass}>庫存上限</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  className={`${fieldClass} mt-0.5 w-20`}
                  value={newMaxQty}
                  onChange={(e) => setNewMaxQty(Number(e.target.value) || 0)}
                />
                <span className="text-xs text-muted">件</span>
              </div>
            </div>
          )}
          {newConditionType === 'NEW_ARRIVAL' && (
            <div>
              <label className={labelClass}>上架天數內</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  className={`${fieldClass} mt-0.5 w-20`}
                  value={newWithinDays}
                  onChange={(e) => setNewWithinDays(Number(e.target.value) || 30)}
                />
                <span className="text-xs text-muted">天</span>
              </div>
            </div>
          )}
          <div className="flex items-end">
            <Button type="button" size="sm" variant="primary" onClick={() => void handleCreate()} disabled={!newName.trim()} data-testid="e2e-admin-discount-tags-create-add-btn">
              新增
            </Button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-content">現有標籤</h2>
        {loading ? (
          <p className="mt-2 text-sm text-muted">載入中…</p>
        ) : tags.length === 0 ? (
          <p className="mt-2 text-sm text-muted">尚無標籤，請先至類別管理建立標籤，或於上方新增。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tags.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-surface bg-table-head px-3 py-2"
              >
                {editId === t.id ? (
                  <>
                    <input
                      type="text"
                      className={`${fieldClass} w-24`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={editShowInPos}
                        onChange={(e) => setEditShowInPos(e.target.checked)}
                      />
                      <span className="text-xs">POS 篩選</span>
                    </label>
                    <select
                      className={fieldClass}
                      value={editConditionType}
                      onChange={(e) => setEditConditionType(e.target.value)}
                    >
                      {CONDITION_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {editConditionType === 'SALES_QTY' && (
                      <>
                        <span className="flex items-center gap-1">
                          <input type="number" min={1} className={`${fieldClass} w-16`} value={editLookbackDays} onChange={(e) => setEditLookbackDays(Number(e.target.value) || 30)} />
                          <span className="text-xs text-muted">天</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="number" min={1} className={`${fieldClass} w-16`} value={editMinQty} onChange={(e) => setEditMinQty(Number(e.target.value) || 1)} />
                          <span className="text-xs text-muted">件</span>
                        </span>
                      </>
                    )}
                    {editConditionType === 'DISCOUNT_RATIO' && (
                      <span className="flex items-center gap-1">
                        <input type="number" min={0} className={`${fieldClass} w-16`} value={editMinPercent} onChange={(e) => setEditMinPercent(Number(e.target.value) || 0)} />
                        <span className="text-xs text-muted">%</span>
                      </span>
                    )}
                    {editConditionType === 'LOW_STOCK' && (
                      <span className="flex items-center gap-1">
                        <input type="number" min={0} className={`${fieldClass} w-16`} value={editMaxQty} onChange={(e) => setEditMaxQty(Number(e.target.value) || 0)} />
                        <span className="text-xs text-muted">件</span>
                      </span>
                    )}
                    {editConditionType === 'NEW_ARRIVAL' && (
                      <span className="flex items-center gap-1">
                        <input type="number" min={1} className={`${fieldClass} w-16`} value={editWithinDays} onChange={(e) => setEditWithinDays(Number(e.target.value) || 30)} />
                        <span className="text-xs text-muted">天</span>
                      </span>
                    )}
                    <Button type="button" size="sm" variant="primary" onClick={() => void saveEdit()}>儲存</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditId(null)}>取消</Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{t.name}</span>
                    {t.showInPosDiscount && <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-xs text-brand-primary">POS</span>}
                    <span className="text-xs text-muted">
                      {getConditionType(t.autoCondition) === 'SALES_QTY' && '銷量達門檻'}
                      {getConditionType(t.autoCondition) === 'DISCOUNT_RATIO' && '有折扣'}
                      {getConditionType(t.autoCondition) === 'LOW_STOCK' && '低庫存'}
                      {getConditionType(t.autoCondition) === 'NEW_ARRIVAL' && '新上架'}
                      {getConditionType(t.autoCondition) === 'MANUAL' && '僅手動'}
                    </span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(t)}>編輯</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void handleDelete(t)}>刪除</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
