import React, { useCallback, useEffect, useState } from 'react';
import {
  listDispatchRules,
  createDispatchRule,
  updateDispatchRule,
  deleteDispatchRule,
  listSegments,
  getOpsJobsStatus,
  type DispatchRuleRow,
  type SegmentRow,
  type OpsJobStatusItem,
  type ApiError,
} from '../../modules/admin/adminApi';
import { listLoyaltyCoupons } from '../../modules/admin/loyaltyApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';
import { Button } from '../../shared/components/Button';
import { Alert } from '../../shared/components/Alert';
import { useNavigate } from 'react-router-dom';

const SCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'manual', label: '手動' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
];

const ENABLED_FILTER: { key: boolean | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: true, label: '啟用' },
  { key: false, label: '停用' },
];

export const AdminDispatchRulesPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const navigate = useNavigate();
  const merchantId = useDefaultMerchantId();
  const [rules, setRules] = useState<DispatchRuleRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [coupons, setCoupons] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [enabledFilter, setEnabledFilter] = useState<boolean | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formSegmentId, setFormSegmentId] = useState('');
  const [formCouponId, setFormCouponId] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formScheduleType, setFormScheduleType] = useState('manual');
  const [formCronExpr, setFormCronExpr] = useState('');
  const [formNextRunAt, setFormNextRunAt] = useState('');

  const [jobStatus, setJobStatus] = useState<OpsJobStatusItem[]>([]);

  const loadRules = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    const enabled = enabledFilter === 'all' ? undefined : enabledFilter;
    const out = await listDispatchRules(merchantId, enabled);
    setLoading(false);
    if (!Array.isArray(out)) {
      setErr(getErrorMessage(out as ApiError));
      setRules([]);
      return;
    }
    setRules(out);
  }, [merchantId, enabledFilter]);

  const loadSegments = useCallback(async () => {
    if (!merchantId) return;
    const out = await listSegments(merchantId, 1, 200);
    if ('items' in out) setSegments(out.items);
  }, [merchantId]);

  const loadCoupons = useCallback(async () => {
    if (!merchantId) return;
    const r = await listLoyaltyCoupons(merchantId);
    if (r && 'items' in r) setCoupons(r.items.map((c) => ({ id: c.id, code: c.code, name: c.name })));
  }, [merchantId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    void loadSegments();
    void loadCoupons();
  }, [loadSegments, loadCoupons]);

  useEffect(() => {
    void (async () => {
      const out = await getOpsJobsStatus();
      setJobStatus(out && 'items' in out ? out.items : []);
    })();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormName('');
    setFormSegmentId(segments[0]?.id ?? '');
    setFormCouponId(coupons[0]?.id ?? '');
    setFormEnabled(true);
    setFormScheduleType('manual');
    setFormCronExpr('');
    setFormNextRunAt('');
    setFormOpen(true);
  };

  const openEdit = (row: DispatchRuleRow) => {
    setEditingId(row.id);
    setFormName(row.name);
    setFormSegmentId(row.segmentId);
    setFormCouponId(row.couponId);
    setFormEnabled(row.enabled);
    setFormScheduleType(row.scheduleType);
    setFormCronExpr(row.cronExpr ?? '');
    setFormNextRunAt(row.nextRunAt ? row.nextRunAt.slice(0, 16) : '');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!merchantId || !formName.trim() || !formSegmentId || !formCouponId) {
      showToast('缺少名稱、分群或優惠券', 'err');
      return;
    }
    if (!['manual', 'daily', 'weekly', 'monthly'].includes(formScheduleType)) {
      showToast('排程類型須為手動、每日、每週或每月', 'err');
      return;
    }
    setSaving(true);
    setErr(null);
    if (editingId) {
      const out = await updateDispatchRule(merchantId, editingId, {
        name: formName.trim(),
        segmentId: formSegmentId,
        couponId: formCouponId,
        enabled: formEnabled,
        scheduleType: formScheduleType,
        cronExpr: formCronExpr.trim() || null,
        nextRunAt: formNextRunAt.trim() ? formNextRunAt : null,
      });
      setSaving(false);
      if ('statusCode' in out) {
        showToast(getErrorMessage(out as ApiError), 'err');
        return;
      }
      showToast('已更新發券規則');
    } else {
      const out = await createDispatchRule(merchantId, {
        name: formName.trim(),
        segmentId: formSegmentId,
        couponId: formCouponId,
        enabled: formEnabled,
        scheduleType: formScheduleType,
        cronExpr: formCronExpr.trim() || undefined,
        nextRunAt: formNextRunAt.trim() || undefined,
      });
      setSaving(false);
      if ('statusCode' in out) {
        showToast(getErrorMessage(out as ApiError), 'err');
        return;
      }
      showToast('已新增發券規則');
    }
    closeForm();
    void loadRules();
  };

  const handleToggleEnabled = async (row: DispatchRuleRow) => {
    if (!merchantId) return;
    setTogglingId(row.id);
    setErr(null);
    const out = await updateDispatchRule(merchantId, row.id, { enabled: !row.enabled });
    setTogglingId(null);
    if ('statusCode' in out) {
      showToast(getErrorMessage(out as ApiError), 'err');
      return;
    }
    showToast(row.enabled ? '已停用' : '已啟用');
    void loadRules();
  };

  const handleDelete = async (row: DispatchRuleRow) => {
    if (!confirm('確定刪除「' + row.name + '」？')) return;
    if (!merchantId) return;
    setDeletingId(row.id);
    setErr(null);
    const out = await deleteDispatchRule(merchantId, row.id);
    setDeletingId(null);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      showToast(getErrorMessage(out as ApiError), 'err');
      return;
    }
    showToast('已刪除');
    void loadRules();
  };

  const segmentName = (id: string) => segments.find((s) => s.id === id)?.name ?? id;
  const couponLabel = (id: string) => {
    const c = coupons.find((x) => x.id === id);
    return c ? `${c.name} (${c.code})` : id;
  };

  return (
    <div
      className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm"
      data-testid="e2e-admin-dispatch-rules"
    >
      <div className="mb-4 rounded-xl border border-brand-surface bg-table-head p-4">
        <h3 className="mb-2 text-sm font-semibold text-content">最近 job 狀態</h3>
        <p className="mb-2 text-xs text-muted">
          資料來源 <code className="rounded bg-white px-1">GET /ops/jobs/status</code>
        </p>
        {jobStatus.length === 0 ? (
          <p className="text-sm text-muted">尚無執行紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="border-b border-brand-surface text-muted">
                <tr>
                  <th className="w-[220px] px-3 py-1.5 text-left">Job 類型</th>
                  <th className="w-[220px] px-3 py-1.5 text-right">最近執行</th>
                  <th className="w-[120px] px-3 py-1.5 text-center">結果</th>
                  <th className="px-3 py-1.5 text-left">訊息</th>
                </tr>
              </thead>
              <tbody>
                {jobStatus.map((j) => (
                  <tr key={j.jobType} className="border-t border-brand-surface">
                    <td className="px-3 py-1.5 font-medium">{j.jobType}</td>
                    <td className="px-3 py-1.5 tabular-nums text-right text-muted">
                      {j.lastRunAt ? new Date(j.lastRunAt).toLocaleString('zh-TW') : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          j.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {j.success ? '成功' : '失敗'}
                      </span>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-1.5 text-left text-xs text-muted">
                      {j.message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {err && (
        <div className="mb-4"><Alert variant="error">{err}</Alert></div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {ENABLED_FILTER.map((f) => (
            <button
              key={String(f.key)}
              type="button"
              className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
                enabledFilter === f.key
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                  : 'border-brand-surface bg-white text-muted hover:border-brand-surface'
              }`}
              onClick={() => setEnabledFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="primary"
          className="rounded-xl px-4 shadow-md shadow-brand-primary/20"
          onClick={openNew}
          disabled={!merchantId}
        >
          + 新增發券規則
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-surface">
        <div className="table-sticky-head overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">名稱</th>
                <th className="px-4 py-2 font-semibold">分群</th>
                <th className="px-4 py-2 font-semibold">優惠券</th>
                <th className="px-4 py-2 font-semibold">排程</th>
                <th className="px-4 py-2 font-semibold">狀態</th>
                <th className="px-4 py-2 font-semibold">下次執行</th>
                <th className="px-4 py-2 font-semibold">最近一次</th>
                <th className="px-4 py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    載入中…
                  </td>
                </tr>
              )}
              {!loading && rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    尚無發券規則，請新增
                  </td>
                </tr>
              )}
              {!loading &&
                rules.map((row) => (
                  <tr key={row.id} className="border-t border-brand-surface hover:bg-table-head">
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-muted">{segmentName(row.segmentId)}</td>
                    <td className="px-4 py-2 text-muted">{couponLabel(row.couponId)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-brand-canvas px-2 py-0.5 text-xs">
                        {SCHEDULE_OPTIONS.find((o) => o.value === row.scheduleType)?.label ?? row.scheduleType}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.enabled ? 'bg-brand-success/12 text-brand-success ring-1 ring-brand-success/20' : 'bg-brand-canvas text-muted ring-1 ring-brand-surface'
                        }`}
                      >
                        {row.enabled ? '啟用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {row.nextRunAt ? new Date(row.nextRunAt).toLocaleString('zh-TW') : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      <div className="flex min-w-[240px] flex-col gap-0.5">
                        <span className="tabular-nums" data-testid="e2e-dispatch-rules-lastRunAt">
                          {row.lastRunAt ? new Date(row.lastRunAt).toLocaleString('zh-TW') : '—'}
                        </span>
                        {row.lastRunCode ? (
                          <span
                            className="font-mono text-[11px] text-muted"
                            data-testid="e2e-dispatch-rules-lastRunCode"
                          >
                            {row.lastRunCode}
                          </span>
                        ) : null}
                        {row.lastRunNote ? (
                          <span
                            className="max-w-[320px] truncate text-[11px] text-muted"
                            title={row.lastRunNote}
                            data-testid="e2e-dispatch-rules-lastRunNote"
                          >
                            {row.lastRunNote}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="w-fit text-[11px] font-medium text-sky-700 hover:underline"
                          data-testid="e2e-dispatch-rules-run-log"
                          onClick={() => {
                            // 導向 ops jobs 讓 E2E 可驗證對應 run log 與 jobId 訊息
                            navigate('/admin/ops/jobs?kind=crm-run-scheduled');
                          }}
                        >
                          查看 run log
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-brand-primary hover:underline disabled:opacity-50"
                          onClick={() => openEdit(row)}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="text-brand-primary hover:underline disabled:opacity-50"
                          onClick={() => handleToggleEnabled(row)}
                          disabled={togglingId === row.id}
                        >
                          {togglingId === row.id ? '處理中…' : row.enabled ? '停用' : '啟用'}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? '刪除中…' : '刪除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-surface bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-[#1e293b]">
              {editingId ? '編輯發券規則' : '新增發券規則'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">名稱 *</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：生日禮券"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">分群 *</label>
                <select
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
                  value={formSegmentId}
                  onChange={(e) => setFormSegmentId(e.target.value)}
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">優惠券 *</label>
                <select
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
                  value={formCouponId}
                  onChange={(e) => setFormCouponId(e.target.value)}
                >
                  {coupons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="form-enabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-brand-surface text-brand-primary"
                />
                <label htmlFor="form-enabled" className="text-sm text-muted">
                  啟用
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">排程類型 *</label>
                <select
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
                  value={formScheduleType}
                  onChange={(e) => setFormScheduleType(e.target.value)}
                >
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Cron 表達式（選填）</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm font-mono"
                  value={formCronExpr}
                  onChange={(e) => setFormCronExpr(e.target.value)}
                  placeholder="例：0 9 * * *"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">下次執行時間（選填）</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
                  value={formNextRunAt}
                  onChange={(e) => setFormNextRunAt(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" className="rounded-xl" onClick={closeForm}>
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                className="rounded-xl"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                {saving ? '儲存中…' : editingId ? '儲存' : '新增'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
