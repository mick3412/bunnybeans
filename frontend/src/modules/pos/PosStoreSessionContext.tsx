import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStores, getWarehouses } from './posOrdersApi';
import { POS_DEFAULT_STORE_KEY } from '../../shared/constants/pos';

export interface StoreOption {
  id: string;
  name: string;
  merchantId?: string;
}

interface PosStoreSessionState {
  apiStoreId: string | null;
  setApiStoreId: (id: string | null) => void;
  apiStores: StoreOption[];
  apiMerchantId: string | null;
  setApiMerchantId: (id: string | null) => void;
  apiLoadError: string | null;
  storeName: string | undefined;
}

const PosStoreSessionContext = createContext<PosStoreSessionState | null>(null);

export function PosStoreSessionProvider({ children }: { children: React.ReactNode }) {
  const [apiStoreId, setApiStoreId] = useState<string | null>(null);
  const [apiStores, setApiStores] = useState<StoreOption[]>([]);
  const [apiMerchantId, setApiMerchantId] = useState<string | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setApiLoadError(null);
      const storesRes = await getStores();
      if (!mounted) return;
      if (Array.isArray(storesRes) && storesRes.length > 0) {
        setApiStores(storesRes.map((s) => ({ id: s.id, name: s.name, merchantId: s.merchantId })));
        let chosen: string | null = null;
        try {
          const defaultId = localStorage.getItem(POS_DEFAULT_STORE_KEY)?.trim();
          if (defaultId && storesRes.some((s) => s.id === defaultId)) {
            chosen = defaultId;
          }
        } catch {
          /* ignore */
        }
        if (!chosen) {
          const withWh = storesRes.find((s) => (s.warehouseIds?.length ?? 0) > 0);
          if (withWh) chosen = withWh.id;
          if (!withWh) {
            const wh = await getWarehouses();
            if (Array.isArray(wh)) {
              const linked = wh.find((w) => w.storeId);
              if (linked?.storeId) chosen = linked.storeId;
            }
          }
          if (!chosen) chosen = storesRes[0].id;
        }
        const foundStore = storesRes.find((s) => s.id === chosen);
        setApiStoreId(chosen);
        setApiMerchantId(foundStore?.merchantId ?? storesRes[0]?.merchantId ?? null);
      } else {
        setApiStoreId(null);
        setApiMerchantId(null);
      }
      if (!Array.isArray(storesRes)) setApiLoadError(storesRes.message ?? '無法載入門市');
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSetStore = useCallback((id: string | null) => {
    setApiStoreId(id);
    const found = apiStores.find((s) => s.id === id);
    setApiMerchantId(found?.merchantId ?? null);
  }, [apiStores]);

  const storeName = useMemo(
    () => (apiStoreId ? apiStores.find((s) => s.id === apiStoreId)?.name : undefined),
    [apiStoreId, apiStores],
  );

  const value = useMemo(
    () => ({
      apiStoreId,
      setApiStoreId: handleSetStore,
      apiStores,
      apiMerchantId,
      setApiMerchantId,
      apiLoadError,
      storeName,
    }),
    [apiStoreId, handleSetStore, apiStores, apiMerchantId, apiLoadError, storeName],
  );

  return (
    <PosStoreSessionContext.Provider value={value}>
      {children}
    </PosStoreSessionContext.Provider>
  );
}

export function usePosStoreSession(): PosStoreSessionState {
  const ctx = useContext(PosStoreSessionContext);
  if (!ctx) {
    throw new Error('usePosStoreSession must be used within PosStoreSessionProvider');
  }
  return ctx;
}
