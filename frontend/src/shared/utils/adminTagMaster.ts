/** 與商品標籤同一套前端 Tag master；TODO: 後端 Tag API 就緒後改由 API 取得 */
export const TAG_STORAGE_KEY = 'admin-tag-master';
export const DEFAULT_TAGS = ['熱賣', '新到貨', '長銷', '即期'];

export function loadTagMaster(): string[] {
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : DEFAULT_TAGS;
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_TAGS];
}

export function saveTagMaster(tags: string[]): void {
  try {
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags));
  } catch {
    /* ignore */
  }
}
