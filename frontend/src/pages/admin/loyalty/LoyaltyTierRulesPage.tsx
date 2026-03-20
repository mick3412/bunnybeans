import React, { useEffect, useState } from 'react';
import {
  listTierRules,
  createTierRule,
  updateTierRule,
  deleteTierRule,
  recalcTiers,
  type TierRuleDto,
} from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../../shared/components/Button';
import { TextInput } from '../../../shared/components/TextInput';
import { useAdminToast } from '../AdminToastContext';

export const LoyaltyTierRulesPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const { showToast } = useAdminToast();
  const [rules, setRules] = useState<TierRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<TierRuleDto | null>(null);
  const [form, setForm] = useState<{
    name: string;
    ruleType: string;
    threshold: string;
    targetLevel: string;
    lookbackDays: string;
  }>({
    name: '',
    ruleType: 'SPEND_SUM',
    threshold: '10000',
    targetLevel: 'VIP',
    lookbackDays: '365',
  });

  const load = async () => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    const out = await listTierRules(merchantId);
    setLoading(false);
    if ('statusCode' in (out as ApiError)) {
      setErr((out as ApiError).message);
      setRules([]);
      return;
    }
    setRules(out as TierRuleDto[]);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: '',
      ruleType: 'SPEND_SUM',
      threshold: '10000',
      targetLevel: '',
      lookbackDays: '365',
    });
  };

  const onEdit = (rule: TierRuleDto) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      ruleType: rule.ruleType,
      threshold: String(rule.threshold),
      targetLevel: rule.targetLevel,
      lookbackDays: String(rule.lookbackDays),
    });
  };

  const save = async () => {
    if (!merchantId) return;
    const thresholdNum = Number(form.threshold);
    const lookbackNum = Number(form.lookbackDays || '365');
    if (!form.name.trim() || !form.targetLevel.trim() || !Number.isFinite(thresholdNum)) {
      showToast('缺少名稱、等級或門檻金額', 'err');
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      ruleType: form.ruleType,
      threshold: thresholdNum,
      targetLevel: form.targetLevel.trim(),
      lookbackDays: lookbackNum,
    };
    const out = editing
      ? await updateTierRule(merchantId, editing.id, body)
      : await createTierRule(merchantId, body);
    setSaving(false);
    if ('statusCode' in (out as ApiError)) {
      const msg = (out as ApiError).message;
      setErr(msg);
      showToast(msg, 'err');
      return;
    }
    showToast(editing ? '已更新等級規則' : '已新增等級規則', 'ok');
    resetForm();
    void load();
  };

  const remove = async (rule: TierRuleDto) => {
    if (!merchantId) return;
    if (!confirm(`確定刪除規則「${rule.name}」？`)) return;
    const out = await deleteTierRule(merchantId, rule.id);
    if (out && 'statusCode' in (out as ApiError)) {
      const msg = (out as ApiError).message;
      showToast(msg, 'err');
      return;
    }
    showToast('已刪除等級規則', 'ok');
    if (editing?.id === rule.id) resetForm();
    void load();
  };

  const runRecalc = async () => {
    if (!merchantId) return;
    setSaving(true);
    const out = await recalcTiers(merchantId);
    setSaving(false);
    if ('statusCode' in (out as ApiError)) {
      showToast((out as ApiError).message, 'err');
      return;
    }
    showToast(`已重算會員等級：更新 ${out.updated} 筆`, 'ok');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-brand-surface pb-2">
        <h2 className="text-lg font-semibold text-content">會員等級規則</h2>
        <p className="mt-1 text-sm text-muted">
          依「區間消費金額」自動升級會員等級；目前僅支援 SPEND_SUM 規則，依門檻由高到低套用。
        </p>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-content">規則列表</span>
            <Button type="button" variant="secondary" onClick={runRecalc} disabled={saving}>
              依規則重新計算會員等級
            </Button>
          </div>
          <div className="table-sticky-head overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">名稱</th>
                  <th className="px-3 py-2 text-right">門檻金額</th>
                  <th className="px-3 py-2 text-right">觀察天數</th>
                  <th className="px-3 py-2">目標等級</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted">
                      尚未設定任何等級規則。
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-content">{r.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {Number(r.threshold).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted">
                      {r.lookbackDays} 天
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                        {r.targetLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <button
                        type="button"
                        className="mr-2 text-brand-primary hover:underline"
                        onClick={() => onEdit(r)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => void remove(r)}
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
        <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-content">
              {editing ? '編輯等級規則' : '新增等級規則'}
            </span>
            {editing && (
              <button
                type="button"
                className="text-xs font-medium text-brand-primary hover:underline"
                onClick={resetForm}
              >
                改為新增
              </button>
            )}
          </div>
          <div className="space-y-3">
            <TextInput
              label="規則名稱"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder=""
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="目標等級代碼"
                value={form.targetLevel}
                onChange={(e) => setForm((f) => ({ ...f, targetLevel: e.target.value }))}
                placeholder=""
              />
              <TextInput
                label="觀察天數（lookbackDays）"
                type="number"
                value={form.lookbackDays}
                onChange={(e) => setForm((f) => ({ ...f, lookbackDays: e.target.value }))}
              />
            </div>
            <TextInput
              label="區間內消費門檻金額（threshold）"
              type="number"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-muted">
              規則類型目前固定為「區間消費總額（SPEND_SUM）」：在觀察天數內，金額達門檻者會被升級到指定等級；若多條規則同時符合，套用門檻較高者。
            </p>
            <div className="flex gap-2 border-t border-brand-surface pt-3">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? '儲存中…' : '儲存規則'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                清空
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

