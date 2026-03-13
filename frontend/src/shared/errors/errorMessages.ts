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
  INVENTORY_INVALID_INPUT: '請檢查庫存 API 參數',
  FINANCE_UNSUPPORTED_EVENT_TYPE: '金流類型不支援',
  FINANCE_CURRENCY_REQUIRED: '請提供幣別',
  FINANCE_AMOUNT_INVALID: '金額必須為數字',
  POS_CUSTOMER_NOT_FOUND: '找不到客戶，請重新選擇',
  POS_ORDER_ALREADY_SETTLED: '此單已收齊，無需補款',
  POS_PAYMENT_EXCEEDS_REMAINING: '補款金額不可超過未收金額',
  POS_CREDIT_NO_RECEIVABLE: '無法對此單補款，請聯繫管理員',
  POS_REFUND_NO_PAYMENT: '此單無實收紀錄，無法退款（全賒帳單請走沖帳流程）',
  POS_REFUND_EXCEEDS_PAID: '退款金額超過可退餘額（實收扣除已退）',
  ADMIN_API_KEY_REQUIRED:
    '後台寫入需管理金鑰：請在 Vercel／本機 build 設定 VITE_ADMIN_API_KEY（與後端 ADMIN_API_KEY 相同），勿 commit。',
  POS_RETURN_ITEMS_EMPTY: '請至少選擇一項商品並填寫退貨入庫數量',
  POS_RETURN_PRODUCT_NOT_ON_ORDER: '該商品不在此訂單明細內',
  POS_RETURN_EXCEEDS_SOLD: '退貨入庫數量不可超過原銷售數量',
  POS_STORE_NO_WAREHOUSE: '門市未綁倉庫，無法退貨入庫（請 seed 或後台建立倉庫）',
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

