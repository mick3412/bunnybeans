const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkImportJobRateLimit(clientKey: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const key = clientKey || 'unknown';
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  if (b.count >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.ceil(
      (WINDOW_MS - (now - b.windowStart)) / 1000,
    );
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  b.count += 1;
  return { ok: true };
}
