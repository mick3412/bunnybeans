import { useCallback, useMemo } from 'react';
import { useSearchParams, type NavigateOptions } from 'react-router-dom';

/**
 * A small wrapper to scope URL query params under a prefix so multiple hubs/pages
 * can safely coexist without clobbering each other's keys.
 *
 * Example:
 *   const [sp, setSp] = useScopedSearchParams('finance.reports')
 *   sp.get('preset') <=> URL has `finance.reports.preset=...`
 */
export function useScopedSearchParams(prefix: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scopedPrefix = `${prefix}.`;

  const scopedParams = useMemo(() => {
    const next = new URLSearchParams();
    for (const [k, v] of searchParams.entries()) {
      if (!k.startsWith(scopedPrefix)) continue;
      next.set(k.slice(scopedPrefix.length), v);
    }
    return next;
  }, [searchParams, scopedPrefix]);

  const setScopedSearchParams = useCallback(
    (nextInit: URLSearchParams | null, navigateOptions?: NavigateOptions) => {
      const base = new URLSearchParams(searchParams);

      // Remove all keys inside this scope first, then write the new ones.
      for (const k of Array.from(base.keys())) {
        if (k.startsWith(scopedPrefix)) base.delete(k);
      }

      if (nextInit) {
        for (const [k, v] of nextInit.entries()) {
          base.set(`${scopedPrefix}${k}`, v);
        }
      }

      setSearchParams(base, navigateOptions);
    },
    [searchParams, setSearchParams, scopedPrefix],
  );

  return [scopedParams, setScopedSearchParams] as const;
}

