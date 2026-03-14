import React from 'react';
import { AdminStoresPage } from './AdminStoresPage';
import { AdminWarehousesPage } from './AdminWarehousesPage';

/** 門市 + 倉庫同一頁（先維護門市，再綁倉庫） */
export const AdminWarehousesStoresPage: React.FC = () => {
  return (
    <div className="max-w-7xl space-y-2" data-testid="e2e-admin-warehouses-stores">
      <p className="mb-6 text-sm text-slate-600">
        同頁維護門市與倉庫；新增倉庫時可選擇所屬門市（storeId）。寬螢幕左右並排，窄螢幕上下。
      </p>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <AdminStoresPage embedded />
        </div>
        <div className="min-w-0 flex-1 border-t border-slate-200 pt-8 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-8">
          <AdminWarehousesPage embedded />
        </div>
      </div>
    </div>
  );
};
