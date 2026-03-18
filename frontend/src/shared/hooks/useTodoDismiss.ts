import { useCallback, useEffect, useMemo, useState } from 'react';

type Stored = {
  dismissed: Record<string, true>;
  snoozeUntil: Record<string, number>;
};

const STORAGE_KEY = 'forge_admin_todos_v1';

function loadStored(now: number): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: {}, snoozeUntil: {} };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const dismissed = typeof parsed.dismissed === 'object' && parsed.dismissed ? parsed.dismissed : {};
    const snoozeUntil = typeof parsed.snoozeUntil === 'object' && parsed.snoozeUntil ? parsed.snoozeUntil : {};
    // 清理過期 snooze
    const nextSnooze: Record<string, number> = {};
    for (const [k, v] of Object.entries(snoozeUntil)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > now) nextSnooze[k] = v;
    }
    return { dismissed: dismissed as Record<string, true>, snoozeUntil: nextSnooze };
  } catch {
    return { dismissed: {}, snoozeUntil: {} };
  }
}

function saveStored(s: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function useTodoDismiss() {
  const [stored, setStored] = useState<Stored>(() => loadStored(Date.now()));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setStored(loadStored(Date.now()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isHidden = useCallback(
    (key: string) => {
      const now = Date.now();
      if (stored.dismissed[key]) return true;
      const until = stored.snoozeUntil[key];
      return typeof until === 'number' && until > now;
    },
    [stored.dismissed, stored.snoozeUntil],
  );

  const dismiss = useCallback((key: string) => {
    setStored((prev) => {
      const next: Stored = {
        dismissed: { ...prev.dismissed, [key]: true },
        snoozeUntil: { ...prev.snoozeUntil },
      };
      delete next.snoozeUntil[key];
      saveStored(next);
      return next;
    });
  }, []);

  const snooze = useCallback((key: string, ms: number) => {
    const until = Date.now() + ms;
    setStored((prev) => {
      const next: Stored = {
        dismissed: { ...prev.dismissed },
        snoozeUntil: { ...prev.snoozeUntil, [key]: until },
      };
      saveStored(next);
      return next;
    });
  }, []);

  const restore = useCallback((key: string) => {
    setStored((prev) => {
      const next: Stored = { dismissed: { ...prev.dismissed }, snoozeUntil: { ...prev.snoozeUntil } };
      delete next.dismissed[key];
      delete next.snoozeUntil[key];
      saveStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setStored(() => {
      const next: Stored = { dismissed: {}, snoozeUntil: {} };
      saveStored(next);
      return next;
    });
  }, []);

  const dismissedKeys = useMemo(() => new Set(Object.keys(stored.dismissed)), [stored.dismissed]);

  return { isHidden, dismiss, snooze, restore, clearAll, dismissedKeys };
}

