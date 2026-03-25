/** ProductTagDto autoCondition 型別（精簡） */
export interface AutoConditionLike {
  type?: string;
  lookbackDays?: number;
  minQty?: number;
  minPercent?: number;
  maxQty?: number;
  withinDays?: number;
}

function getConditionType(ac: AutoConditionLike | null | undefined): string {
  if (ac && typeof ac === 'object' && 'type' in ac) return String(ac.type ?? 'MANUAL');
  return 'MANUAL';
}

function getConditionParams(ac: AutoConditionLike | null | undefined): Record<string, number> {
  if (!ac || typeof ac !== 'object') return {};
  return ac as Record<string, number>;
}

/** 將 autoCondition 轉為可讀說明（與 AdminDiscountTagsPage 一致） */
export function formatAutoConditionDetail(ac: AutoConditionLike | null | undefined): string {
  const type = getConditionType(ac);
  const p = getConditionParams(ac);
  if (type === 'MANUAL') return '僅手動';
  if (type === 'SALES_QTY') return `近 ${p.lookbackDays ?? 30} 日銷量 ≥ ${p.minQty ?? 10}`;
  if (type === 'DISCOUNT_RATIO') return `折扣 ≥ ${p.minPercent ?? 5}%`;
  if (type === 'LOW_STOCK') return `庫存 ≤ ${p.maxQty ?? 3}`;
  if (type === 'NEW_ARRIVAL') return `${p.withinDays ?? 30} 日內上架`;
  return '僅手動';
}
