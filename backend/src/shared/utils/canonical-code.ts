/**
 * Canonical code rules for Category / Brand / ProductTag (aligned with frontend slugify).
 * - Character set: a-z0-9- (lowercase)
 * - Normalization: NFKD decompose, strip diacritics, collapse non-alphanumeric to single dash
 * - Chinese / non-ASCII: fallback to deterministic hash x-${base36}
 * - Dedupe: suffix -2, -3, ... up to 9999; beyond that use timestamp
 */
const CODE_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/;

/** Slugify name to canonical code. Matches frontend slugifyLoose. */
export function slugify(input: string): string {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return '';
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  if (ascii) return ascii;
  let h = 0;
  for (const ch of raw) h = ((h * 131 + (ch.codePointAt(0) ?? 0)) >>> 0);
  return `x-${h.toString(36)}`;
}

/** Check if code matches allowed charset (a-z0-9-, non-empty, no leading/trailing dash). */
export function isValidCode(code: string): boolean {
  const c = (code ?? '').trim().toLowerCase();
  if (!c) return false;
  return CODE_REGEX.test(c);
}

/** Produce a unique code by appending -2, -3, ... when base already exists. Deterministic. */
export function dedupeCode(base: string, existingCodes: string[]): string {
  const b = base.trim().toLowerCase();
  if (!b) return '';
  const set = new Set(existingCodes.map((x) => x.toLowerCase()));
  if (!set.has(b)) return b;
  for (let i = 2; i < 10_000; i += 1) {
    const cand = `${b}-${i}`;
    if (!set.has(cand)) return cand;
  }
  return `${b}-${Date.now()}`;
}

/** Resolve final code: if provided, validate and dedupe; if empty, derive from name then dedupe. */
export function resolveCode(
  providedCode: string | undefined,
  name: string,
  existingCodes: string[],
): { code: string; derived: boolean } {
  const provided = (providedCode ?? '').trim();
  if (provided) {
    const lower = provided.toLowerCase();
    if (!isValidCode(lower)) {
      throw new Error('CODE_INVALID');
    }
    return { code: dedupeCode(lower, existingCodes), derived: false };
  }
  const base = slugify(name);
  if (!base) throw new Error('NAME_REQUIRED');
  return { code: dedupeCode(base, existingCodes), derived: true };
}
