import React, { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; message: string; variant: 'ok' | 'err' };

const Ctx = createContext<{
  showToast: (message: string, variant?: 'ok' | 'err') => void;
} | null>(null);

let idSeq = 0;

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, variant: 'ok' | 'err' = 'ok') => {
    const id = ++idSeq;
    setToasts((t) => [...t, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);
  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-md ${
              t.variant === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
            data-testid="e2e-admin-toast"
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAdminToast() {
  const v = useContext(Ctx);
  if (!v) return { showToast: (_m: string, _v?: 'ok' | 'err') => {} };
  return v;
}
