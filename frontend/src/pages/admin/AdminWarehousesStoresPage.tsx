import React from 'react';
import { AdminStoresPage } from './AdminStoresPage';
import { AdminWarehousesPage } from './AdminWarehousesPage';

const cardClass = 'min-w-0 flex-1 rounded-xl border border-brand-surface bg-white p-6 shadow-sm';

/** 門市 + 倉庫同一頁，雙列表佈局一致（先維護門市，再綁倉庫） */
export const AdminWarehousesStoresPage: React.FC = () => {
  return (
    <div className="max-w-6xl" data-testid="e2e-admin-warehouses-stores">
      <p className="mb-6 text-sm text-muted">
        同頁維護門市與倉庫；新增倉庫時可選擇所屬門市（storeId）。寬螢幕左右並排，窄螢幕上下。
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <AdminStoresPage embedded />
        </div>
        <div className={cardClass}>
          <AdminWarehousesPage embedded />
        </div>
      </div>
    </div>
  );
};
