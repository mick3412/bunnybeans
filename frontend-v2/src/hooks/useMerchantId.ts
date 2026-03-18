import { useMemo } from 'react';

const DEFAULT_MERCHANT = 'default-merchant';

export function useMerchantId(): string {
  return useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_MERCHANT;
    const q = new URLSearchParams(window.location.search);
    const m = q.get('merchantId');
    if (m?.trim()) return m.trim();
    try {
      const stored = localStorage.getItem('pos-erp-merchant-id');
      if (stored?.trim()) return stored.trim();
    } catch {
      /* ignore */
    }
    return DEFAULT_MERCHANT;
  }, []);
}
