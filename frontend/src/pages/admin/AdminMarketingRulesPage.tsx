import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Button } from '../../shared/components/Button';
import { listOpsJobs, type ApiError, type OpsJobRunLogItem } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminMarketingRulesPage: React.FC = () => {
  const navigate = useNavigate();
  const [lastRun, setLastRun] = useState<OpsJobRunLogItem | null>(null);
  const [lastRunErr, setLastRunErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLastRunErr(null);
      const out = await listOpsJobs({ kind: 'crm-run-scheduled', page: 1, pageSize: 1 });
      if (!out || typeof out !== 'object' || !('items' in out)) {
        setLastRun(null);
        setLastRunErr(getErrorMessage(out as ApiError));
        return;
      }
      const rows = (out.items ?? []) as OpsJobRunLogItem[];
      setLastRun(rows[0] ?? null);
    })();
  }, []);

  const lastRunSummary = useMemo(() => {
    if (!lastRun && !lastRunErr) return null;
    return (
      <div className="rounded-xl border border-brand-surface bg-white p-4">
        <div className="text-xs font-semibold text-muted">最近一次執行（crm-run-scheduled）</div>
        {lastRunErr ? (
          <div className="mt-2 text-xs text-brand-danger">{lastRunErr}</div>
        ) : lastRun ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="text-xs text-muted">時間：{new Date(lastRun.createdAt).toLocaleString('zh-TW')}</div>
              <div className="mt-1 text-xs text-muted">
                狀態：
                <span className={lastRun.success ? 'ml-1 font-semibold text-brand-success' : 'ml-1 font-semibold text-brand-danger'}>
                  {lastRun.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              {lastRun.message ? <div className="mt-1 text-xs text-muted">message：{lastRun.message}</div> : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/ops/jobs?kind=${encodeURIComponent(lastRun.jobType)}`)}
            >
              前往 Job 監控
            </Button>
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted">尚無紀錄</div>
        )}
      </div>
    );
  }, [lastRun, lastRunErr, navigate]);
  return (
    <StandardListLayout
      title="行銷發券規則（常駐）"
      description="本頁為常駐發券規則的最小工作台。若後端 API 尚未就緒，將先提供入口與作業指引，不假裝成功。"
      actions={
        <Button type="button" variant="primary" size="sm" onClick={() => navigate('/admin/marketing/rules/new')}>
          新增規則
        </Button>
      }
      aboveContent={lastRunSummary}
      empty
      emptyMessage="尚無規則（或後端尚未提供 API）"
      emptyDescription={
        <span>
          - 若後端已提供常駐規則 API：下一步會在此串接列表/啟用停用/編輯。<br />
          - 目前可先到 <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/admin/ops/jobs?kind=crm-run-scheduled')}>Job 監控</Button> 查看最近一次 CRM 排程發券執行結果。
        </span>
      }
      testId="e2e-admin-marketing-rules"
    />
  );
};

