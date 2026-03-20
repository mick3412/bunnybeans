import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Button } from '../../shared/components/Button';
import { TextInput } from '../../shared/components/TextInput';
import { hasAdminApiKey } from '../../shared/rbac/adminKey';

export const AdminMarketingRuleEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const canWrite = hasAdminApiKey();

  const [form, setForm] = useState({
    name: '',
    enabled: true,
    scheduleType: 'cron',
    cronExpr: '0 9 * * *',
    segmentId: '',
    couponId: '',
  });

  const title = useMemo(() => (isNew ? '新增行銷規則（常駐）' : '編輯行銷規則（常駐）'), [isNew]);

  return (
    <StandardListLayout
      title={title}
      description=""
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/admin/marketing/rules')}>
          返回列表
        </Button>
      }
      testId="e2e-admin-marketing-rule-edit"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="text-sm font-semibold text-content">基本設定</div>
          <div className="mt-3 space-y-3">
            <TextInput
              label="規則名稱"
              placeholder=""
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-muted">啟用</span>
              <select
                value={form.enabled ? 'true' : 'false'}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.value === 'true' }))}
                className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="true">啟用</option>
                <option value="false">停用</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="text-sm font-semibold text-content">排程與條件</div>
          <div className="mt-3 space-y-3">
            <TextInput
              label="cronExpr"
              placeholder="0 9 * * *"
              value={form.cronExpr}
              onChange={(e) => setForm((f) => ({ ...f, cronExpr: e.target.value }))}
            />
            <TextInput
              label="segmentId"
              placeholder=""
              value={form.segmentId}
              onChange={(e) => setForm((f) => ({ ...f, segmentId: e.target.value }))}
            />
            <TextInput
              label="couponId"
              placeholder=""
              value={form.couponId}
              onChange={(e) => setForm((f) => ({ ...f, couponId: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" disabled>
          {isNew ? '建立規則' : '儲存變更'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/admin/ops/jobs?kind=crm-run-scheduled')}>
          查看最近一次執行（Job 監控）
        </Button>
        {/* 權限提示已隱藏，改由 .env VITE_ADMIN_API_KEY 配置 */}
      </div>
    </StandardListLayout>
  );
};

