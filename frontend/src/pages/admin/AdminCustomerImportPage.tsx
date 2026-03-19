import React, { useRef, useState } from 'react';
import {
  previewCustomersImport,
  applyCustomersImport,
  type CustomerImportPreviewRow,
  type CustomerImportApplyDecision,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminToast } from './AdminToastContext';

function defaultAction(r: CustomerImportPreviewRow): CustomerImportApplyDecision {
  if (!r.conflict) return { row: r.row, action: 'create' };
  const hasDb = r.reasons.includes('db') && r.existing?.id;
  if (hasDb) return { row: r.row, action: 'skip' };
  return { row: r.row, action: 'skip' };
}

function decisionsToCsv(
  rows: CustomerImportPreviewRow[],
  decisions: Map<number, CustomerImportApplyDecision>,
): string {
  const skipRows = rows.filter((r) => decisions.get(r.row)?.action === 'skip');
  const header = 'name,phone,memberLevel,code';
  const lines = skipRows.map((r) => {
    const esc = (s: string | null) => {
      if (s == null) return '';
      const x = String(s).replace(/"/g, '""');
      return /[",\n]/.test(x) ? `"${x}"` : x;
    };
    return [esc(r.name), esc(r.phone), esc(r.memberLevel), esc(r.code)].join(',');
  });
  return [header, ...lines].join('\n');
}

export const AdminCustomerImportPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const fileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const inputKey = useRef(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerImportPreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; reason: string }[]>([]);
  const [decisions, setDecisions] = useState<Map<number, CustomerImportApplyDecision>>(new Map());
  const hasAdminKey = Boolean((import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim());
  const adminKeyRequiredMsg = getErrorMessage({ statusCode: 401 });

  const resetPreview = () => {
    setFileHash(null);
    setRows([]);
    setParseErrors([]);
    setDecisions(new Map());
  };

  const onPickFile = (f: File | null) => {
    fileRef.current = f;
    setFileName(f?.name ?? '');
    resetPreview();
  };

  const runPreview = async () => {
    const f = fileRef.current;
    if (!f || !merchantId) {
      showToast('缺少商家或 CSV 檔', 'err');
      return;
    }
    if (!hasAdminKey) {
      showToast(adminKeyRequiredMsg, 'err');
      return;
    }
    setPreviewLoading(true);
    setErr(null);
    const out = await previewCustomersImport(f, merchantId);
    setPreviewLoading(false);
    if ('statusCode' in out) {
      if (out.statusCode === 401) {
        setErr(adminKeyRequiredMsg);
        showToast(adminKeyRequiredMsg, 'err');
      } else {
        setErr(getErrorMessage(out));
      }
      return;
    }
    setFileHash(out.fileHash);
    setRows(out.rows);
    setParseErrors(out.parseErrors ?? []);
    const m = new Map<number, CustomerImportApplyDecision>();
    for (const r of out.rows) m.set(r.row, defaultAction(r));
    setDecisions(m);
    showToast(`預覽 ${out.rows.length} 列`, 'ok');
  };

  const setDecision = (row: number, patch: Partial<CustomerImportApplyDecision>) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      const cur = next.get(row);
      if (!cur) return prev;
      const r = rows.find((x) => x.row === row);
      const merged = { ...cur, ...patch };
      if (merged.action === 'overwrite' && r?.existing?.id) merged.customerId = r.existing.id;
      if (merged.action !== 'overwrite') delete merged.customerId;
      next.set(row, merged as CustomerImportApplyDecision);
      return next;
    });
  };

  const skipRest = () => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const r of rows) {
        const d = next.get(r.row);
        if (d) next.set(r.row, { row: r.row, action: 'skip' });
      }
      return next;
    });
  };

  const downloadSkippedCsv = () => {
    const csv = decisionsToCsv(rows, decisions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customers-skipped.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runApply = async () => {
    const f = fileRef.current;
    if (!f || !merchantId || !fileHash) {
      showToast('缺少預覽資料', 'err');
      return;
    }
    const list: CustomerImportApplyDecision[] = rows.map((r) => {
      const d = decisions.get(r.row);
      return d ?? { row: r.row, action: 'skip' };
    });
    if (list.length !== rows.length) {
      showToast('決策列數與預覽不一致', 'err');
      return;
    }
    setApplyLoading(true);
    setErr(null);
    const out = await applyCustomersImport(f, merchantId, fileHash, list);
    setApplyLoading(false);
    if ('statusCode' in out) {
      const msg =
        out.code === 'CUSTOMER_IMPORT_FILE_HASH_MISMATCH'
          ? '檔案與預覽不一致'
          : out.statusCode === 401
            ? adminKeyRequiredMsg
            : getErrorMessage(out as ApiError);
      setErr(msg);
      showToast(msg, 'err');
      return;
    }
    showToast(
      `建立 ${out.created}、更新 ${out.updated}、略過 ${out.skipped}；失敗 ${out.failed.length}`,
      out.failed.length ? 'err' : 'ok',
    );
    resetPreview();
    fileRef.current = null;
    setFileName('');
    inputKey.current += 1;
  };

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm" data-testid="e2e-admin-customers-import">
      <p className="mb-2 text-sm text-[#64748b]" aria-hidden="true" />
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 shadow-sm">
        <input
          ref={fileInputRef}
          key={inputKey.current}
          type="file"
          accept=".csv,text/csv"
          disabled={!hasAdminKey}
          className="hidden"
          aria-label="選擇 CSV 檔案"
          data-testid="e2e-admin-customers-import-file"
          title={!hasAdminKey ? adminKeyRequiredMsg : undefined}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onPickFile(f);
          }}
        />
        <div data-testid="e2e-admin-customers-import-preview" className="contents">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={!hasAdminKey}
            data-testid="e2e-admin-customers-import-preview-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {fileName ? `已選：${fileName}` : '選擇 CSV 檔案'}
          </Button>
          {fileName && (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={previewLoading || !merchantId || !hasAdminKey}
                data-testid="e2e-admin-customers-import-run-preview-btn"
                onClick={runPreview}
              >
                {previewLoading ? '預覽中…' : '預覽'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  fileRef.current = null;
                  setFileName('');
                  inputKey.current += 1;
                  resetPreview();
                }}
              >
                重選檔案
              </Button>
            </>
          )}
          {rows.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={applyLoading || !hasAdminKey}
              data-testid="e2e-admin-customers-import-run-apply-btn"
              onClick={runApply}
            >
              {applyLoading ? '套用中…' : '套用寫入'}
            </Button>
          )}
        </div>
      </div>

      {parseErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <div className="font-semibold text-amber-900">解析略過列</div>
          <ul className="mt-1 list-inside list-disc text-amber-800">
            {parseErrors.map((p) => (
              <li key={p.row}>
                列 {p.row}: {p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={skipRest}>
              全部略過（Skip Rest）
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={downloadSkippedCsv}>
              下載目前「略過」列 CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={applyLoading || !hasAdminKey}
              onClick={runApply}
            >
              {applyLoading ? '套用中…' : '套用寫入'}
            </Button>
          </div>
          <div className="table-sticky-head overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-xs text-[#64748b]">
                <tr>
                  <th className="px-2 py-2">列</th>
                  <th className="px-2 py-2">name</th>
                  <th className="px-2 py-2">phone</th>
                  <th className="px-2 py-2">衝突</th>
                  <th className="px-2 py-2">既有</th>
                  <th className="px-2 py-2">動作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = decisions.get(r.row);
                  const canOverwrite = r.conflict && r.reasons.includes('db') && r.existing?.id;
                  return (
                    <tr key={r.row} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 tabular-nums">{r.row}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5">{r.phone ?? '—'}</td>
                      <td className="px-2 py-1.5 text-xs">
                        {r.conflict ? r.reasons.join(',') : '—'}
                      </td>
                      <td className="max-w-[160px] truncate px-2 py-1.5 text-xs">
                        {r.existing ? `${r.existing.name ?? ''} (${r.existing.id.slice(0, 8)}…)` : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="rounded border border-[#e2e8f0] px-1 py-0.5 text-xs"
                          value={d?.action ?? 'skip'}
                          onChange={(e) => {
                            const action = e.target.value as CustomerImportApplyDecision['action'];
                            setDecision(r.row, {
                              action,
                              customerId: action === 'overwrite' ? r.existing?.id : undefined,
                            });
                          }}
                        >
                          <option value="skip">略過</option>
                          <option value="create">建立</option>
                          {canOverwrite && <option value="overwrite">覆寫（既有）</option>}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-[#64748b]">
            <span data-testid="e2e-admin-customers-import-filehash-preview">
              fileHash（預覽）: {fileHash?.slice(0, 16)}…
            </span>{' '}
            · 套用時會比對同檔
          </p>
        </>
      )}
    </div>
  );
};
