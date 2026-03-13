import { useMemo, useState } from 'react';
import type { CartItem, CartSummary, PosProduct } from './types';

/** 暫時關閉：客戶目前未稅經營 */
const TAX_RATE = 0;

export const usePosCart = () => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addProduct = (product: PosProduct) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
      };
      return [...prev, newItem];
    });
  };

  const changeQuantity = (itemId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((item) => (item.id === itemId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const clearCart = () => setItems([]);

  const summary: CartSummary = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [items]);

  return {
    items,
    summary,
    addProduct,
    changeQuantity,
    clearCart,
  };
};

