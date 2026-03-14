/** 簡易 CSV 解析（支援 " 包裹與 "" 跳脫） */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuote = false;
  const s = text.replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i];
    if (inQuote) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuote = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      row.push(cell);
      cell = '';
      if (c === '\r' && s[i + 1] === '\n') i++;
      i++;
      if (row.length > 1 || row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  if (row.length > 1 || row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export const PRODUCT_IMPORT_MAX_ROWS = 10_000;
