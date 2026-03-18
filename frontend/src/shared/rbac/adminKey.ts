export const ADMIN_KEY_REQUIRED_HINT =
  '此操作需管理金鑰（VITE_ADMIN_API_KEY）。若你是唯讀角色或尚未配置金鑰，請聯繫管理員。';

export function hasAdminApiKey(): boolean {
  return Boolean((import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim());
}

