import type { PosOrderDetail } from '../../../modules/pos/posOrdersMockService';

export type ProductMetaMap = Record<string, { id: string; sku?: string; name?: string; categoryId?: string }>;
export type CategoryMetaMap = Record<string, { id: string; name: string }>;

export interface OrderDetailComputed {
  displayPaid: number;
  remainingAmount: number;
  credit: boolean;
  paymentMethodsText: string;
}

export interface CommonActionState {
  payMethod: 'CASH' | 'CARD' | 'TRANSFER';
  payAmount: string;
  paySubmitting: boolean;
  payError: string | null;
  refundAmount: string;
  refundNote: string;
  refundSubmitting: boolean;
  refundError: string | null;
  returnQtyByLine: Record<string, string>;
  returnStockSubmitting: boolean;
  returnStockError: string | null;
  returnStockOk: string | null;
}

export interface OrderContextData {
  order: PosOrderDetail;
  returnTo: string | null;
  customerIdDisplay: string | null;
  customerNameDisplay: string | null;
  customerCodeDisplay: string | null;
  computed: OrderDetailComputed;
  productMap: ProductMetaMap;
  categoryMap: CategoryMetaMap;
}
