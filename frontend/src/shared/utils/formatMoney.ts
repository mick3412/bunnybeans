/** 共用金額／整數格式化（TWD） */

export function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

export function formatMoney(s: string | number): string {
  const n = typeof s === 'string' ? Number(s) : s;
  if (Number.isNaN(n)) return String(s);
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Pos 報表等：字串金額轉 TWD 顯示 */
export function formatMoneyFromString(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return formatMoney(n);
}
