export interface PosProduct {
  id: string;
  name: string;
  price: number;
}

/** 僅供 POS 商品區顯示與篩選用，結帳/API 仍用 PosProduct */
export interface PosProductDisplay extends PosProduct {
  sku?: string;
  /** 門市倉庫彙總庫存（GET /pos/products 提供）；未提供時為 undefined */
  onHandQty?: number;
  categoryId?: string;
  brandId?: string;
  tags?: string[];
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CartSummary {
  subtotal: number;
  tax: number;
  total: number;
  totalQuantity: number;
}

