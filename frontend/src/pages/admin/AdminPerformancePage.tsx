import React from 'react';
import { PosReportsPage } from '../PosReportsPage';

/**
 * 後台業績頁：複用收銀端報表內容（業績概覽、熱銷品項、區間趨勢）。
 * 與 /pos/reports 共用 PosReportsPage 元件。
 */
export const AdminPerformancePage: React.FC = () => <PosReportsPage />;
