export const ERROR_CODE_MAP: Record<string, string> = {
  POS_ITEMS_EMPTY: '至少需要一項商品',
  POS_STORE_NOT_FOUND: '找不到門市',
  /** 結帳／退貨入庫皆可能回傳 */
  POS_STORE_NO_WAREHOUSE: '門市尚未設定庫存倉庫',
  POS_PRODUCT_NOT_FOUND: '部分商品不存在',
  POS_PAYMENT_MISMATCH: '付款金額與訂單金額不一致',
  POS_CREDIT_REQUIRES_CUSTOMER: '掛帳需要客戶資訊',
  POS_CREDIT_CUSTOMER_NOT_FOUND: '客戶不存在',
  POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS: '客戶資訊不唯一',
  POS_PAYMENT_EXCEEDS_TOTAL: '實收金額不可超過訂單總額',
  POS_PAYMENT_AMOUNT_INVALID: '付款金額不正確',
  INVENTORY_INSUFFICIENT: '庫存不足',
  POS_ORDER_NOT_FOUND: '找不到此訂單',
  INVENTORY_PRODUCT_NOT_FOUND: '商品不存在',
  INVENTORY_WAREHOUSE_NOT_FOUND: '倉庫不存在',
  INVENTORY_INVALID_INPUT: '庫存參數不正確',
  FINANCE_UNSUPPORTED_EVENT_TYPE: '金流類型不支援',
  FINANCE_CURRENCY_REQUIRED: '缺少幣別',
  FINANCE_AMOUNT_INVALID: '金額必須為數字',
  FINANCE_PERIOD_CLOSED: '該日期所在區間已關帳，無法寫入',
  FINANCE_PERIOD_OVERLAP: '關帳區間無效：起迄日需為有效日期且起日不得晚於迄日',
  FINANCE_PERIOD_ALREADY_CLOSED: '關帳區間與既有已關帳區間重疊（請調整起迄日）',
  FINANCE_PERIOD_NOT_FOUND: '找不到此關帳區間，可能已被刪除或無權限',
  POS_CUSTOMER_NOT_FOUND: '找不到客戶',
  POS_ORDER_ALREADY_SETTLED: '此單已收齊，無需補款',
  POS_PAYMENT_EXCEEDS_REMAINING: '補款金額不可超過未收金額',
  POS_CREDIT_NO_RECEIVABLE: '無法對此單補款，請聯繫管理員',
  POS_REFUND_NO_PAYMENT: '此單無實收紀錄，無法退款（全賒帳單請走沖帳流程）',
  POS_REFUND_EXCEEDS_PAID: '退款金額超過可退餘額（實收扣除已退）',
  CATEGORY_IN_USE: '仍有商品使用此分類，無法刪除。',
  ADMIN_API_KEY_REQUIRED:
    '後台寫入需管理金鑰：需提供 VITE_ADMIN_API_KEY（與後端 ADMIN_API_KEY 相同）。',
  POS_RETURN_ITEMS_EMPTY: '退貨入庫至少需要一項商品與數量',
  POS_RETURN_PRODUCT_NOT_ON_ORDER: '該商品不在此訂單明細內',
  POS_RETURN_EXCEEDS_SOLD: '退貨入庫數量不可超過原銷售數量',
};

export interface AdminApiErrorLike {
  code?: string;
  message?: string;
  statusCode?: number;
}

export function getErrorMessage(input: { code?: string; message?: string; statusCode?: number }): string {
  const { code, message, statusCode } = input;
  if (statusCode === 401) {
    return (
      ERROR_CODE_MAP.ADMIN_API_KEY_REQUIRED ??
      '此操作需後台金鑰，請設定 VITE_ADMIN_API_KEY（與後端 ADMIN_API_KEY 相同）。'
    );
  }
  if (statusCode === 403) {
    if (code && ERROR_CODE_MAP[code]) return ERROR_CODE_MAP[code];
    return '權限不足（Forbidden）';
  }
  if (code && ERROR_CODE_MAP[code]) {
    return ERROR_CODE_MAP[code];
  }
  if (message && message.trim().length > 0) {
    return message;
  }
  return '發生錯誤，請稍後再試。';
}

export function showAdminApiErrorToast(
  showToast: (message: string, variant?: 'ok' | 'err') => void,
  error: AdminApiErrorLike,
): void {
  if (error.statusCode === 401) return;
  const msg = getErrorMessage(error);
  showToast(msg, 'err');
}


