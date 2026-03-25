import React from 'react';
import { Button } from '../../../shared/components/Button';

export const OrderHeader: React.FC<{
  returnTo: string | null;
  onBackToSource: () => void;
  onBackToOrders: () => void;
  onBackToPos: () => void;
}> = ({ returnTo, onBackToSource, onBackToOrders, onBackToPos }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-brand-surface pb-2">
    <h2 className="text-lg font-semibold text-content">訂單明細</h2>
    <div className="flex flex-wrap gap-2">
      {returnTo ? (
        <Button type="button" size="sm" variant="secondary" onClick={onBackToSource}>
          回到來源
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" onClick={onBackToOrders}>
        返回列表
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onBackToPos}>
        收銀
      </Button>
    </div>
  </div>
);
