import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/components/Button';

/** 404：未知路徑 */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-forge-main px-4">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="text-xl font-semibold text-content">找不到頁面</h1>
      <p className="max-w-sm text-center text-sm text-muted">您要開啟的網址不存在，或已變更。</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/login">
          <Button type="button" variant="primary">
            前往登入
          </Button>
        </Link>
        <Link to="/pos">
          <Button type="button" variant="secondary">
            門市收銀
          </Button>
        </Link>
        <Link to="/admin">
          <Button type="button" variant="secondary">
            後台
          </Button>
        </Link>
      </div>
    </div>
  );
};
