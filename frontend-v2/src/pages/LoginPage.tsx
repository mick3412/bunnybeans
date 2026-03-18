import React from 'react';
import { useNavigate } from 'react-router-dom';

const MERCHANT_STORAGE_KEY = 'pos-erp-merchant-id';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById('login-merchant') as HTMLInputElement | null;
    const value = input?.value?.trim();
    if (value) {
      try {
        localStorage.setItem(MERCHANT_STORAGE_KEY, value);
      } catch {
        /* ignore */
      }
    }
    navigate('/admin');
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-canvas)' }}
    >
      <div
        className="w-full max-w-sm rounded-lg border p-6 shadow-sm"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <div className="mb-6 flex items-center justify-center gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold text-white"
            style={{ backgroundColor: 'var(--color-sidebar)' }}
          >
            P
          </span>
          <span className="text-lg font-semibold" style={{ color: 'var(--color-content)' }}>
            POS ERP
          </span>
        </div>
        <h1 className="mb-4 text-center text-lg font-semibold" style={{ color: 'var(--color-content)' }}>
          登入
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-merchant" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>
              商家
            </label>
            <input
              id="login-merchant"
              type="text"
              placeholder="預設商家"
              className="input-base"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-95"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            進入後台
          </button>
        </form>
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          開發版：點擊即進入後台
        </p>
      </div>
    </div>
  );
};
