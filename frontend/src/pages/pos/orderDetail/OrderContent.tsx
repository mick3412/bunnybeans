import React from 'react';
import { formatMoney } from '../../../shared/utils/formatMoney';
import type { OrderContextData } from './types';

export const OrderContent: React.FC<{
  ctx: OrderContextData;
}> = ({ ctx }) => {
  const { order, customerIdDisplay, customerNameDisplay, customerCodeDisplay, computed, productMap, categoryMap, storeMap } = ctx;
  const storeName = storeMap[order.storeId]?.name || (order as { storeName?: string | null }).storeName || order.storeId;
  const discountAmount = typeof order.discountAmount === 'number' ? order.discountAmount : 0;
  const promotionDetailLines = (() => {
    const applied = (order as { promotionApplied?: unknown }).promotionApplied as
      | { ruleName?: string; applied?: Array<{ name?: string; off?: number; discount?: number }> }
      | undefined;
    if (!applied || typeof applied !== 'object') return [] as Array<{ name: string; amount: number | null }>;
    if (Array.isArray(applied.applied) && applied.applied.length > 0) {
      return applied.applied.map((x) => ({
        name: x.name || applied.ruleName || '促銷折扣',
        amount: typeof x.off === 'number' ? x.off : typeof x.discount === 'number' ? x.discount : null,
      }));
    }
    if (applied.ruleName) return [{ name: applied.ruleName, amount: null }];
    return [];
  })();
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-brand-surface bg-table-head/90 px-3 py-2 sm:px-4">
        <div className="text-[10px] font-semibold uppercase text-muted">消費者</div>
        <div className="mt-1 space-y-0.5 text-content">
          <div>
            <span className="text-muted">ID</span>{' '}
            <span className="break-all font-mono text-[11px]">{customerIdDisplay ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted">姓名</span>{' '}
            <span className="font-medium">{customerNameDisplay ?? '—'}</span>
          </div>
          {customerCodeDisplay ? (
            <div>
              <span className="text-muted">代碼</span> {customerCodeDisplay}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-between border-b border-brand-surface pb-2">
        <span className="text-muted">單號</span>
        <span className="font-medium text-content">{order.orderNumber}</span>
      </div>
      <div className="flex justify-between border-b border-brand-surface pb-2">
        <span className="text-muted">門市</span>
        <span className="break-all text-right text-content">{storeName || order.storeId}</span>
      </div>
      <div className="flex justify-between border-b border-brand-surface pb-2">
        <span className="text-muted">建立時間</span>
        <span className="text-content">{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
      </div>

      <div className="pt-1">
        <div className="mb-1.5 font-medium text-muted">品項</div>
        <div className="-mx-1 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-surface text-[11px] text-muted">
                <th className="py-1.5">分類</th>
                <th className="py-1.5">品牌</th>
                <th className="py-1.5">品名</th>
                <th className="py-1.5">商品 ID</th>
                <th className="py-1.5 text-right">數量</th>
                <th className="py-1.5 text-right">單價</th>
                <th className="py-1.5 text-right">小計</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-brand-surface">
                  {(() => {
                    const meta = productMap[item.productId];
                    const category = meta?.categoryId ? categoryMap[meta.categoryId] : undefined;
                    return (
                      <>
                        <td className="py-1.5 text-muted">{category?.name ?? '—'}</td>
                        <td className="py-1.5 text-muted">—</td>
                        <td className="py-1.5 text-content">{meta?.name ?? '—'}</td>
                        <td className="py-1.5 font-mono text-[11px] text-muted">{meta?.sku ?? item.productId}</td>
                      </>
                    );
                  })()}
                  <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{formatMoney(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 border-t border-brand-surface pt-2 text-sm">
        <div className="rounded-lg border border-brand-surface bg-table-head/70 px-2 py-2 text-xs">
          <div className="mb-1 font-semibold text-content">促銷折扣</div>
          <div className="flex justify-between text-muted">
            <span>折扣總額</span>
            <span className="tabular-nums">{discountAmount > 0 ? `-${formatMoney(discountAmount)}` : '—'}</span>
          </div>
          {promotionDetailLines.length > 0 ? (
            <div className="mt-1.5 space-y-1 border-t border-brand-surface pt-1.5">
              {promotionDetailLines.map((line, idx) => (
                <div key={`${line.name}-${idx}`} className="flex justify-between text-muted">
                  <span className="truncate pr-2">{line.name}</span>
                  <span className="tabular-nums">{line.amount != null ? `-${formatMoney(line.amount)}` : '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 text-muted">未套用促銷</div>
          )}
        </div>
        <div className="flex justify-between font-semibold">
          <span>應收金額</span>
          <span className="tabular-nums">{formatMoney(order.totalAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>實收合計</span>
          <span className="tabular-nums">{formatMoney(computed.displayPaid)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>未收餘額</span>
          <span className="tabular-nums font-medium">{formatMoney(computed.remainingAmount)}</span>
        </div>
        {computed.credit ? (
          <div className="rounded-lg bg-brand-warning/10 px-2 py-1 text-center text-[11px] font-medium text-brand-warning" data-testid="e2e-detail-remaining">
            掛帳（尚有未收） {formatMoney(computed.remainingAmount)}
          </div>
        ) : null}
        <div className="flex justify-between border-t border-brand-surface pt-2 text-xs font-normal">
          <span className="text-muted">收款方式</span>
          <span className="max-w-[70%] text-right text-content">{computed.paymentMethodsText}</span>
        </div>
      </div>
    </div>
  );
};
