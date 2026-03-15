import React, { useEffect, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { listMerchants, type MerchantDto } from '../../../modules/admin/adminApi';

const MOCK_MERCHANT = 'mock-merchant-1';

export const LoyaltyLayout: React.FC = () => {
  const [merchantId, setMerchantId] = useState(MOCK_MERCHANT);
  const [merchants, setMerchants] = useState<MerchantDto[]>([]);
  useEffect(() => {
    void (async () => {
      const m = await listMerchants();
      if (Array.isArray(m) && m.length) {
        setMerchants(m);
        setMerchantId((prev) => (prev === MOCK_MERCHANT ? m[0].id : prev));
      }
    })();
  }, []);

  return (
    <div
      className="min-h-[calc(100vh-8rem)] rounded-xl border border-neutral-200 bg-white shadow-sm"
      data-testid="e2e-admin-loyalty"
    >
      <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-2">
        <label className="mr-2 text-xs font-medium text-neutral-600">商家</label>
        <select
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
        >
          {merchants.length === 0 && <option value={merchantId}>{merchantId.slice(0, 8)}…</option>}
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.id}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 overflow-auto bg-neutral-50 p-4 lg:p-6">
        <Outlet context={{ merchantId }} />
      </div>
    </div>
  );
};

export function useLoyaltyOutletContext(): { merchantId: string } {
  return useOutletContext<{ merchantId: string }>();
}
