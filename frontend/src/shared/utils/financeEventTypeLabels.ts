/**
 * FinanceEventType 中文顯示 mapping；API 仍使用原 enum。
 */
export const FINANCE_EVENT_TYPE_LABELS: Record<string, string> = {
  SALE_RECEIVABLE: '銷售應收',
  SALE_PAYMENT: '銷售實收',
  SALE_REFUND: '銷售退款',
  PURCHASE_PAYABLE: '採購應付',
  PURCHASE_REBATE: '採購折讓',
  PURCHASE_RETURN: '退供應商',
  ADJUSTMENT: '人工調整',
};

export function getFinanceEventTypeLabel(type: string): string {
  return FINANCE_EVENT_TYPE_LABELS[type] ?? type;
}
