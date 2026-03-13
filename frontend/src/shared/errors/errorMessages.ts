export const ERROR_CODE_MAP: Record<string, string> = {
  POS_ITEMS_EMPTY: '請至少加入一項商品',
  POS_STORE_NOT_FOUND: '找不到門市，請重新選擇',
  POS_STORE_NO_WAREHOUSE: '門市尚未設定庫存倉庫',
  POS_PRODUCT_NOT_FOUND: '部分商品不存在，請重新整理',
  POS_PAYMENT_MISMATCH: '付款金額與訂單金額不一致',
  POS_CREDIT_REQUIRES_CUSTOMER: '掛帳請選擇或輸入客戶',
  POS_PAYMENT_EXCEEDS_TOTAL: '實收金額不可超過訂單總額',
  POS_PAYMENT_AMOUNT_INVALID: '請檢查付款金額',
  INVENTORY_INSUFFICIENT: '庫存不足，請調整數量或稍後再試',
  POS_ORDER_NOT_FOUND: '找不到此訂單',
  INVENTORY_PRODUCT_NOT_FOUND: '商品不存在',
  INVENTORY_WAREHOUSE_NOT_FOUND: '倉庫不存在',
  FINANCE_UNSUPPORTED_EVENT_TYPE: '金流類型不支援',
  FINANCE_CURRENCY_REQUIRED: '請提供幣別',
  FINANCE_AMOUNT_INVALID: '金額必須為數字',
};

export function getErrorMessage(input: { code?: string; message?: string }): string {
  const { code, message } = input;
  if (code && ERROR_CODE_MAP[code]) {
    return ERROR_CODE_MAP[code];
  }
  if (message && message.trim().length > 0) {
    return message;
  }
  return '發生錯誤，請稍後再試。';
}

