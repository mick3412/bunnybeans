import { api, type ApiError } from './client';

export type CategoryDto = {
  id: string;
  code: string;
  name: string;
};

export async function listCategories(): Promise<CategoryDto[] | ApiError> {
  const out = await api<CategoryDto[]>('categories');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
