export const ADMIN_KEY_REQUIRED_HINT =
  '此操作需管理金鑰（VITE_ADMIN_API_KEY）。若你是唯讀角色或尚未配置金鑰，請聯繫管理員。';

const ADMIN_KEY_STORAGE_KEY = 'admin-api-key';

export function getAdminApiKey(): string {
  const env = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';
  if (env) return env;
  try {
    return (localStorage.getItem(ADMIN_KEY_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function setAdminApiKey(key: string): void {
  try {
    const v = (key ?? '').trim();
    if (!v) localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    else localStorage.setItem(ADMIN_KEY_STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

export function hasAdminApiKey(): boolean {
  return Boolean(getAdminApiKey());
}

