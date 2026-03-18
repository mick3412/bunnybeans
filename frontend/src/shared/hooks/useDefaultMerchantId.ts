import { useEffect, useState } from 'react';
import { getMerchantCurrent, listMerchants } from '../../modules/admin/adminApi';

/** 單一商家：優先 GET /merchant/current（§9），失敗則 fallback listMerchants()[0].id。 */
export function useDefaultMerchantId(): string {
  const [merchantId, setMerchantId] = useState('');
  useEffect(() => {
    void (async () => {
      const current = await getMerchantCurrent();
      if (current && !('statusCode' in current)) {
        setMerchantId(current.id);
        return;
      }
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) {
        setMerchantId(m[0].id);
      }
    })();
  }, []);
  return merchantId;
}
