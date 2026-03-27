import { lazy } from 'react';

/** POS 區域路由級 code splitting（INSTRUCTIONS 033） */
export const PosPageLazy = lazy(() => import('../pages/PosPage').then((m) => ({ default: m.PosPage })));
export const PosOrdersListPageLazy = lazy(() =>
  import('../pages/PosOrdersListPage').then((m) => ({ default: m.PosOrdersListPage })),
);
export const PosOrderDetailPageLazy = lazy(() =>
  import('../pages/PosOrderDetailPage').then((m) => ({ default: m.PosOrderDetailPage })),
);
export const PosAfterSalesPageLazy = lazy(() =>
  import('../pages/PosAfterSalesPage').then((m) => ({ default: m.PosAfterSalesPage })),
);
export const PosPromosPageLazy = lazy(() =>
  import('../pages/PosPromosPage').then((m) => ({ default: m.PosPromosPage })),
);
export const PosReportsPageLazy = lazy(() =>
  import('../pages/PosReportsPage').then((m) => ({ default: m.PosReportsPage })),
);
export const PosMarketBasketPageLazy = lazy(() =>
  import('../pages/PosMarketBasketPage').then((m) => ({ default: m.PosMarketBasketPage })),
);
