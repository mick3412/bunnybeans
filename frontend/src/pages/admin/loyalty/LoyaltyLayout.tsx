import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';

/** 單一商家：merchantId 由 useDefaultMerchantId（優先 GET /merchant/current，fallback listMerchants）提供，無頂端選單。 */
export const LoyaltyLayout: React.FC = () => {
  const merchantId = useDefaultMerchantId();

  return (
    <div className="min-h-[calc(100vh-8rem)] min-w-0 overflow-auto p-4 lg:p-6" data-testid="e2e-admin-loyalty">
      <Outlet context={{ merchantId }} />
    </div>
  );
};

export function useLoyaltyOutletContext(): { merchantId: string } {
  return useOutletContext<{ merchantId: string }>();
}
