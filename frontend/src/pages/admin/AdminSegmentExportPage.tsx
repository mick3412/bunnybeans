import React, { useState } from 'react';
import { exportSegmentCsv, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';

export const AdminSegmentExportPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [segmentId, setSegmentId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleExport = async () => {
    const id = segmentId.trim();
    if (!id) {
      setErr('缺少分群 ID');
      return;
    }
    setExporting(true);
    setErr(null);
    const out = await exportSegmentCsv(id);
    setExporting(false);
    if (out === true) {
      showToast('已下載分群名單 CSV');
    } else {
      const msg = getErrorMessage(out as ApiError);
      setErr(msg);
      showToast(msg, 'err');
    }
  };

  return (
    <div
      className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm"
      data-testid="e2e-admin-segment-export"
    >
      <p className="mb-4 text-sm text-muted">
        依分群 ID 匯出名單 CSV（id, name, phone, memberLevel）。資料來源{' '}
        <code className="rounded bg-brand-canvas px-1 text-content">GET /crm/segments/:id/export</code>，需
        VITE_ADMIN_API_KEY。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-muted">分群 ID</label>
          <input
            type="text"
            className="w-64 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm font-mono"
            placeholder="Segment UUID"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-brand-primary bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover disabled:opacity-50"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? '匯出中…' : '匯出 CSV'}
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
    </div>
  );
};
