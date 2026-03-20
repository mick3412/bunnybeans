import { useEffect, useState } from 'react';
import { getMerchantCurrent, listMerchants } from '../../modules/admin/adminApi';

let resolved = false;
let cachedId = '';
let inFlight: Promise<string> | null = null;

async function resolveMerchantId(): Promise<string> {
  const current = await getMerchantCurrent();
  if (current && !('statusCode' in current)) {
    return current.id;
  }
  const m = await listMerchants();
  if (Array.isArray(m) && m.length) {
    return m[0].id;
  }
  return '';
}

function loadMerchantId(): Promise<string> {
  if (resolved) return Promise.resolve(cachedId);
  if (!inFlight) {
    inFlight = resolveMerchantId().then((id) => {
      cachedId = id;
      resolved = true;
      inFlight = null;
      return id;
    });
  }
  return inFlight;
}

/** 單一商家：優先 GET /merchant/current（§9），失敗則 fallback listMerchants()[0].id。模組級快取避免多元件重複請求。 */
export function useDefaultMerchantId(): string {
  const [merchantId, setMerchantId] = useState(() => (resolved ? cachedId : ''));
  useEffect(() => {
    void loadMerchantId().then(setMerchantId);
  }, []);
  return merchantId;
}
