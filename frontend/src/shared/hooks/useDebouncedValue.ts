import { useEffect, useState } from 'react';

/**
 * 將快速變動的值延遲同步（搜尋框 debounce，INSTRUCTIONS 033）
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
