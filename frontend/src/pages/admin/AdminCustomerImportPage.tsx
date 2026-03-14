import React, { useEffect, useRef, useState } from 'react';
import {
  listMerchants,
  previewCustomersImport,
  applyCustomersImport,
  type CustomerImportPreviewRow,
  type CustomerImportApplyDecision,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
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
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const fileRef = useRef<File | null>(null);
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

  useEffect(() => {
    (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) {
        setMerchants(m.map((x) => ({ id: x.id, name: x.name })));
        setMerchantId((prev) => prev || m[0].id);
      }
    })();
  }, []);

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
      showToast('請選商家與 CSV 檔', 'err');
      return;
    }
    if (!hasAdminKey) {
      showToast('需 VITE_ADMIN_API_KEY', 'err');
      return;
    }
    setPreviewLoading(true);
    setErr(null);
    const out = await previewCustomersImport(f, merchantId);
    setPreviewLoading(false);
    if ('statusCode' in out) {
      setErr(out.statusCode === 401 ? '需 VITE_ADMIN_API_KEY' : getErrorMessage(out));
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
      showToast('請先預覽（同一檔）', 'err');
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
          ? '檔案與預覽不一致，請勿換檔；可再預覽一次'
          : out.statusCode === 401
            ? '需 VITE_ADMIN_API_KEY'
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
    <div className="max-w-5xl" data-testid="e2e-admin-customers-import">
      <h2 className="mb-2 text-lg font-semibold text-neutral-900">客戶 CSV 匯入</h2>
      <p className="mb-4 text-sm text-slate-600">
        先 <strong>預覽</strong>（不寫入），再逐列決策後 <strong>套用</strong>。套用須與預覽<strong>同一檔</strong>。
      </p>
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">商家</label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={merchantId}
            onChange={(e) => {
              setMerchantId(e.target.value);
              resetPreview();
            }}
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div data-testid="e2e-admin-customers-import-preview">
          <label className="mb-1 block text-xs font-medium text-slate-600">CSV</label>
          <input
            key={inputKey.current}
            type="file"
            accept=".csv,text/csv"
            disabled={!hasAdminKey}
            title={!hasAdminKey ? '需 VITE_ADMIN_API_KEY' : undefined}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onPickFile(f);
            }}
          />
          {fileName && <span className="ml-2 text-xs text-slate-500">{fileName}</span>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={previewLoading || !fileRef.current || !merchantId || !hasAdminKey}
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
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
                          className="rounded border border-slate-200 px-1 py-0.5 text-xs"
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
          <p className="mt-2 text-[11px] text-slate-500">
            fileHash（預覽）: {fileHash?.slice(0, 16)}… · 套用時會比對同檔
          </p>
        </>
      )}
    </div>
  );
};
