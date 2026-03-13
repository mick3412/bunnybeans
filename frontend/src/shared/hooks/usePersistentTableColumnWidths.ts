import { useCallback, useRef, useState } from 'react';

export type ColumnWidthMap = Record<string, number>;

const readStored = (storageKey: string, defaults: ColumnWidthMap, minWidth: number): ColumnWidthMap => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = parsed[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= minWidth) next[k] = v;
    }
    return next;
  } catch {
    return { ...defaults };
  }
};

/**
 * 表格欄寬：拖曳調整；放開滑鼠時寫入 localStorage。
 */
export function usePersistentTableColumnWidths(
  storageKey: string,
  defaults: ColumnWidthMap,
  minWidth = 48,
  /** 首次讀取後可修正舊版過窄欄寬並寫回 localStorage */
  migrateOnRead?: (m: ColumnWidthMap) => ColumnWidthMap,
): {
  widths: ColumnWidthMap;
  onResizeStart: (key: string, e: React.MouseEvent) => void;
} {
  const [widths, setWidths] = useState<ColumnWidthMap>(() => {
    let m = readStored(storageKey, defaults, minWidth);
    if (migrateOnRead) {
      const m2 = migrateOnRead(m);
      const changed = Object.keys(m2).some((k) => m2[k] !== m[k]);
      if (changed) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(m2));
        } catch {
          /* ignore */
        }
        m = m2;
      }
    }
    return m;
  });
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const onResizeStart = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widthsRef.current[key] ?? defaults[key];
      const onMove = (ev: MouseEvent) => {
        const w = Math.max(minWidth, Math.round(startW + (ev.clientX - startX)));
        const next = { ...widthsRef.current, [key]: w };
        widthsRef.current = next;
        setWidths(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try {
          localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
        } catch {
          /* ignore */
        }
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [storageKey, defaults, minWidth],
  );

  return { widths, onResizeStart };
}
