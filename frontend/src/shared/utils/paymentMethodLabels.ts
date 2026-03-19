/**
 * 付款方式中文顯示；API 仍使用原值（CASH、CREDIT 等）。
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: '現金',
  CREDIT: '賒帳',
  CARD: '刷卡',
  TRANSFER: '轉帳',
  OTHER: '其他',
};

export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
