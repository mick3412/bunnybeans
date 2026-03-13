// 共用型別與工具之入口檔。之後可從這裡 export DTO、常數等。

export type InventoryEventType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_FROM_CUSTOMER'
  | 'RETURN_TO_SUPPLIER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS';

export interface InventoryEvent {
  id: string;
  occurredAt: string; // ISO datetime
  type: InventoryEventType;
  productId: string;
  warehouseId: string;
  quantity: number; // 正負皆可，依事件類型判斷方向
  referenceId?: string; // 對應銷售單 / 進貨單 / 退貨單等
  note?: string;
}

export type FinanceEventType =
  | 'SALE_RECEIVABLE'
  | 'SALE_PAYMENT'
  | 'SALE_REFUND'
  | 'PURCHASE_PAYABLE'
  | 'PURCHASE_REBATE'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT';

export interface FinanceEvent {
  id: string;
  occurredAt: string; // ISO datetime
  type: FinanceEventType;
  partyId: string; // 客戶或供應商 ID
  currency: string;
  amount: number; // 正負皆可，搭配 type 解讀方向
  taxAmount?: number;
  referenceId?: string; // 對應銷售單 / 進貨單 / 退款單等
  note?: string;
}

