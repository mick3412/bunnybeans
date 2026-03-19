import React from 'react';
import { PosReportsPage } from '../PosReportsPage';

/**
 * 後台業績頁：與 /pos/reports 共用 PosReportsPage 元件。
 * 單一來源維護，無差異；路由 /admin/performance 僅導向同一元件。
 */
export const AdminPerformancePage: React.FC = () => <PosReportsPage />;
