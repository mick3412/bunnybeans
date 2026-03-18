import React, { useCallback, useEffect, useState } from 'react';
import {
  listSegments,
  getSegmentPreview,
  exportSegmentCsv,
  createCrmJob,
  getCrmJob,
  type SegmentRow,
  type ApiError,
} from '../../modules/admin/adminApi';
import { listLoyaltyCoupons } from '../../modules/admin/loyaltyApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';
import { Button } from '../../shared/components/Button';

export const AdminSegmentsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [coupons, setCoupons] = useState<{ id: string; code: string; name: string }[]>([]);
  const [jobSegmentId, setJobSegmentId] = useState('');
  const [jobCouponId, setJobCouponId] = useState('');
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ sent?: number; skipped?: number; errors?: string[] } | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const loadSegments = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    const out = await listSegments(merchantId, 1, 100);
    setLoading(false);
    if (!('items' in out)) {
      setErr(getErrorMessage(out as ApiError));
      setSegments([]);
      return;
    }
    setSegments(out.items);
    setTotal(out.total);
  }, [merchantId]);

  useEffect(() => {
    void loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    if (!merchantId) return;
    listLoyaltyCoupons(merchantId).then((r) => {
      if (r && 'items' in r) setCoupons(r.items.map((c) => ({ id: c.id, code: c.code, name: c.name })));
    });
  }, [merchantId]);

  const handlePreview = async (id: string) => {
    setPreviewId(id);
    setPreviewCount(null);
    const out = await getSegmentPreview(id);
    if (!('count' in out)) {
      showToast(getErrorMessage(out as ApiError), 'err');
      setPreviewId(null);
      return;
    }
    setPreviewCount(out.count);
  };

  const handleExport = async (id: string) => {
    setExportingId(id);
    setErr(null);
    const out = await exportSegmentCsv(id);
    setExportingId(null);
    if (out === true) showToast('已下載分群名單 CSV');
    else {
      setErr(getErrorMessage(out as ApiError));
      showToast(getErrorMessage(out as ApiError), 'err');
    }
  };

  const handleSubmitJob = async () => {
    if (!merchantId || !jobSegmentId.trim() || !jobCouponId.trim()) {
      showToast('請選擇分群與優惠券', 'err');
      return;
    }
    setJobSubmitting(true);
    setJobId(null);
    setJobStatus(null);
    setJobResult(null);
    setJobError(null);
    const out = await createCrmJob('segment-coupon', {
      merchantId,
      segmentId: jobSegmentId.trim(),
      couponId: jobCouponId.trim(),
    });
    setJobSubmitting(false);
    if (!('jobId' in out)) {
      setJobError(getErrorMessage(out as ApiError));
      showToast(getErrorMessage(out as ApiError), 'err');
      return;
    }
    setJobId(out.jobId);
    setJobStatus('pending');
    const poll = async (id: string) => {
      for (let i = 0; i < 120; i++) {
        const j = await getCrmJob(id);
        if (!('status' in j)) {
          setJobError(getErrorMessage(j));
          return;
        }
        setJobStatus(j.status);
        if (j.status === 'done') {
          setJobResult(j.result ?? null);
          showToast(`發券完成：已送 ${j.result?.sent ?? 0}、略過 ${j.result?.skipped ?? 0}`);
          return;
        }
        if (j.status === 'failed') {
          setJobError(j.error ?? 'job failed');
          showToast(j.error ?? 'job failed', 'err');
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      setJobError('輪詢逾時');
    };
    void poll(out.jobId);
  };

  return (
    <div
      className="mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"
      data-testid="e2e-admin-segments"
    >
      <p className="mb-4 text-sm text-[#64748b]">
        分群列表與分群發券。資料來源 <code className="rounded bg-[#f1f5f9] px-1">GET /crm/segments</code>、
        <code className="rounded bg-[#f1f5f9] px-1">POST /crm/jobs/segment-coupon</code>；需 VITE_ADMIN_API_KEY。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}

      <div className="mb-6 overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#1e293b]">分群發券</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-[#64748b]">分群</label>
            <select
              className="w-64 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm"
              value={jobSegmentId}
              onChange={(e) => setJobSegmentId(e.target.value)}
            >
              <option value="">選擇分群</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#64748b]">優惠券</label>
            <select
              className="w-64 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm"
              value={jobCouponId}
              onChange={(e) => setJobCouponId(e.target.value)}
            >
              <option value="">選擇優惠券</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={jobSubmitting || !jobSegmentId || !jobCouponId}
            onClick={() => void handleSubmitJob()}
          >
            {jobSubmitting ? '送出中…' : '送出發券'}
          </Button>
        </div>
        {jobId && (
          <div className="mt-3 border-t border-[#e2e8f0] pt-3 text-xs text-[#64748b]">
            Job: <code className="rounded bg-white px-1">{jobId.slice(0, 8)}…</code> 狀態：{jobStatus}
            {jobResult && (
              <span className="ml-2">
                已送 {jobResult.sent ?? 0}、略過 {jobResult.skipped ?? 0}
              </span>
            )}
          </div>
        )}
        {jobError && (
          <div className="mt-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800">{jobError}</div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#1e293b]">
          分群列表
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-[#64748b]">載入中…</div>
        ) : segments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#64748b]">尚無分群</div>
        ) : (
          <div className="table-sticky-head overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                <tr>
                  <th className="px-4 py-2">名稱</th>
                  <th className="px-4 py-2 font-mono text-xs">ID</th>
                  <th className="px-4 py-2">預覽</th>
                  <th className="px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.id} className="border-t border-[#e2e8f0]">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-[10px] text-[#64748b]">{s.id}</td>
                    <td className="px-4 py-2">
                      {previewId === s.id ? (
                        previewCount !== null ? (
                          <span className="text-[#0ea5e9]">符合 {previewCount} 人</span>
                        ) : (
                          <span className="text-[#64748b]">查詢中…</span>
                        )
                      ) : (
                        <button
                          type="button"
                          className="text-[#0ea5e9] hover:underline"
                          onClick={() => void handlePreview(s.id)}
                        >
                          預覽
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="text-[#0ea5e9] hover:underline disabled:opacity-50"
                        disabled={exportingId === s.id}
                        onClick={() => void handleExport(s.id)}
                      >
                        {exportingId === s.id ? '匯出中…' : '匯出 CSV'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
