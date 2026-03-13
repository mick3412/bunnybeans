import type { PosProduct } from './types';

// 依照 docs/api-design-pos.md
export interface PosOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PosPaymentInput {
  method: string;
  amount: number;
}

export interface CreatePosOrderRequest {
  storeId: string;
  occurredAt?: string;
  items: PosOrderItemInput[];
  payments: PosPaymentInput[];
  customerId?: string | null;
  /** 選填；後端可用於依電話查詢／綁定 Customer */
  customerPhone?: string | null;
  /** 選填；後端可用於依 email 查詢／綁定 Customer */
  customerEmail?: string | null;
  allowCredit?: boolean;
}

export interface PosOrderSummary {
  id: string;
  orderNumber: string;
  storeId: string;
  totalAmount: number;
  createdAt: string;
  /** api-design-pos；後端未回傳時可缺 */
  customerId?: string | null;
  customerName?: string | null;
}

export interface PosOrderDetailItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PosOrderDetailPayment {
  method: string;
  amount: number;
}

export interface PosOrderDetail extends PosOrderSummary {
  items: PosOrderDetailItem[];
  payments: PosOrderDetailPayment[];
  paidAmount: number;
  remainingAmount: number;
  credit: boolean;
  customerCode?: string | null;
}

export interface PosOrderListResponse {
  items: PosOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
}

let mockSequence = 1;

export interface MockPosOrderContext {
  storeId: string;
}

export interface MockOrderProductLookup {
  findById(id: string): PosProduct | undefined;
}

export interface CreatePosOrderResult {
  statusCode: number;
  message: string;
  body?: PosOrderDetail;
}

export const createPosOrderMock = async (
  input: CreatePosOrderRequest,
  context: MockPosOrderContext,
): Promise<CreatePosOrderResult> => {
  if (!input.items.length) {
    return {
      statusCode: 400,
      message: '至少需要一筆銷售品項。',
    };
  }

  const totalAmount = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const allowCredit = Boolean(input.allowCredit);
  const payments: PosOrderDetailPayment[] = (input.payments ?? []).map((p) => ({
    method: p.method,
    amount: p.amount,
  }));
  const paidSum = payments.reduce((s, p) => s + p.amount, 0);

  if (allowCredit) {
    const cid = (input.customerId ?? '').trim();
    if (!cid) {
      return { statusCode: 400, message: '賒帳時未帶 customerId', body: undefined };
    }
    if (paidSum > totalAmount + 0.01) {
      return { statusCode: 400, message: '實收超過應收', body: undefined };
    }
    if (payments.some((p) => p.amount < 0 || Number.isNaN(p.amount))) {
      return { statusCode: 400, message: '付款金額非法', body: undefined };
    }
  } else {
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return { statusCode: 400, message: '付款總額須等於訂單總額', body: undefined };
    }
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const orderNumber = `POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}-${String(mockSequence).padStart(4, '0')}`;
  mockSequence += 1;

  const detailItems: PosOrderDetailItem[] = input.items.map((item, index) => ({
    id: `${id}-item-${index + 1}`,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  const paidAmount = paidSum;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const credit = remainingAmount > 0;

  const cid = (input.customerId ?? '').trim() || null;
  return {
    statusCode: 201,
    message: 'POS 銷售單建立成功（mock）。',
    body: {
      id,
      orderNumber,
      storeId: context.storeId,
      totalAmount,
      createdAt: now.toISOString(),
      customerId: cid,
      customerName: cid ? '（mock 客戶）' : null,
      customerCode: cid ? 'MOCK' : null,
      items: detailItems,
      payments,
      paidAmount,
      remainingAmount,
      credit,
    },
  };
};

export const listPosOrdersMock = async (): Promise<PosOrderListResponse> => {
  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);

  const items: PosOrderSummary[] = Array.from({ length: 5 }).map((_, index) => ({
    id: `mock-order-${index + 1}`,
    orderNumber: `POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`,
    storeId: 'mock-store-1',
    totalAmount: 400 + index * 80,
    createdAt: new Date(baseDate.getTime() + index * 15 * 60 * 1000).toISOString(),
    customerId: index % 2 === 0 ? `mock-cust-${index}` : null,
    customerName: index % 2 === 0 ? `示範客戶 ${index + 1}` : null,
  }));

  return {
    items,
    page: 1,
    pageSize: items.length,
    total: items.length,
  };
};
