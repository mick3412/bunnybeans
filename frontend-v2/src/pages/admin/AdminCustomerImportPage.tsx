import React, { useRef, useState } from 'react';
import {
  previewCustomersImport,
  applyCustomersImport,
  type CustomerImportPreviewRow,
  type CustomerImportApplyDecision,
} from '../../api/customers';
import { useMerchantId } from '../../hooks/useMerchantId';
import { Button } from '../../components/Button';

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
  const merchantId = useMerchantId();
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState('');
  const inputKey = useRef(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerImportPreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; reason: string }[]>([]);
  const [decisions, setDecisions] = useState<Map<number, CustomerImportApplyDecision>>(new Map());
  const hasAdminKey = Boolean((import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim());

  const resetPreview = () => {
    setFileHash(null);
    setRows([]);
    setParseErrors([]);
    setDecisions(new Map());
    setSuccess(null);
  };

  const onPickFile = (f: File | null) => {
    fileRef.current = f;
    setFileName(f?.name ?? '');
    resetPreview();
  };

  const runPreview = async () => {
    const f = fileRef.current;
    if (!f || !merchantId) {
      setErr('請選商家與 CSV 檔');
      return;
    }
    if (!hasAdminKey) {
      setErr('需設定 VITE_ADMIN_API_KEY');
      return;
    }
    setPreviewLoading(true);
    setErr(null);
    const out = await previewCustomersImport(f, merchantId);
    setPreviewLoading(false);
    if ('statusCode' in out) {
      setErr(out.statusCode === 401 ? '需 VITE_ADMIN_API_KEY' : out.message);
      return;
    }
    setFileHash(out.fileHash);
    setRows(out.rows);
    setParseErrors(out.parseErrors ?? []);
    const m = new Map<number, CustomerImportApplyDecision>();
    for (const r of out.rows) m.set(r.row, defaultAction(r));
    setDecisions(m);
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
      for (const r of rows) next.set(r.row, { row: r.row, action: 'skip' });
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
      setErr('請先預覽（套用須與預覽同一檔）');
      return;
    }
    const list: CustomerImportApplyDecision[] = rows.map((r) => {
      const d = decisions.get(r.row);
      return d ?? { row: r.row, action: 'skip' };
    });
    setApplyLoading(true);
    setErr(null);
    setSuccess(null);
    const out = await applyCustomersImport(f, merchantId, fileHash, list);
    setApplyLoading(false);
    if ('statusCode' in out) {
      const msg =
        (out as { code?: string }).code === 'CUSTOMER_IMPORT_FILE_HASH_MISMATCH'
          ? '檔案與預覽不一致，請勿換檔；可再預覽一次'
          : out.statusCode === 401
            ? '需 VITE_ADMIN_API_KEY'
            : out.message;
      setErr(msg);
      return;
    }
    setSuccess(`建立 ${out.created}、更新 ${out.updated}、略過 ${out.skipped}` + (out.failed.length ? `；失敗 ${out.failed.length} 筆` : ''));
    resetPreview();
    fileRef.current = null;
    setFileName('');
    inputKey.current += 1;
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="mb-4 text-sm" style={{ color: 'var(--color-muted)' }}>
          先 <strong>預覽</strong>（不寫入），再逐列決策後 <strong>套用</strong>。套用須與預覽<strong>同一檔</strong>。
        </p>
        {err && <p className="mb-2 text-sm" style={{ color: 'var(--color-danger)' }}>{err}</p>}
        {success && <p className="mb-2 text-sm" style={{ color: 'var(--color-success)' }}>{success}</p>}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>CSV</label>
            <input
              key={inputKey.current}
              type="file"
              accept=".csv,text/csv"
              disabled={!hasAdminKey}
              className="input-base max-w-xs"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {fileName && <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>{fileName}</span>}
          </div>
          <Button
            disabled={previewLoading || !fileRef.current || !merchantId || !hasAdminKey}
            onClick={runPreview}
          >
            {previewLoading ? '預覽中…' : '預覽'}
          </Button>
          <Button variant="secondary" onClick={() => { fileRef.current = null; setFileName(''); inputKey.current += 1; resetPreview(); }}>
            重選檔案
          </Button>
        </div>

        {parseErrors.length > 0 && (
          <div className="mb-4 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--color-warning)', color: 'var(--color-content)' }}>
            <div className="font-medium">解析略過列</div>
            <ul className="mt-1 list-inside list-disc">
              {parseErrors.map((p) => (
                <li key={p.row}>列 {p.row}: {p.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={skipRest}>全部略過</Button>
              <Button variant="secondary" onClick={downloadSkippedCsv}>下載「略過」列 CSV</Button>
              <Button disabled={applyLoading || !hasAdminKey} onClick={runApply}>
                {applyLoading ? '套用中…' : '套用寫入'}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  <tr>
                    <th className="px-2 py-2">列</th>
                    <th className="px-2 py-2">name</th>
                    <th className="px-2 py-2">phone</th>
                    <th className="px-2 py-2">衝突</th>
                    <th className="px-2 py-2">既有</th>
                    <th className="px-2 py-2">動作</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--color-content)' }}>
                  {rows.map((r) => {
                    const d = decisions.get(r.row);
                    const canOverwrite = r.conflict && r.reasons.includes('db') && r.existing?.id;
                    return (
                      <tr key={r.row} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-2 py-1.5 tabular-nums">{r.row}</td>
                        <td className="max-w-[140px] truncate px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.phone ?? '—'}</td>
                        <td className="px-2 py-1.5 text-xs">{r.conflict ? r.reasons.join(',') : '—'}</td>
                        <td className="max-w-[160px] truncate px-2 py-1.5 text-xs">
                          {r.existing ? `${r.existing.name ?? ''} (${r.existing.id.slice(0, 8)}…)` : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="input-base py-1 text-xs"
                            value={d?.action ?? 'skip'}
                            onChange={(e) => {
                              const action = e.target.value as CustomerImportApplyDecision['action'];
                              setDecision(r.row, { action, customerId: action === 'overwrite' ? r.existing?.id : undefined });
                            }}
                          >
                            <option value="skip">略過</option>
                            <option value="create">建立</option>
                            {canOverwrite && <option value="overwrite">覆寫</option>}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>fileHash: {fileHash?.slice(0, 16)}…</p>
          </>
        )}
      </div>
    </div>
  );
};
