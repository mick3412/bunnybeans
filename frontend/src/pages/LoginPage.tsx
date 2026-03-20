import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { TextInput } from '../shared/components/TextInput';

type HealthStatus = 'idle' | 'checking' | 'ok' | 'error';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [healthMessage, setHealthMessage] = useState<string>('');

  const checkHealth = async () => {
    try {
      setHealthStatus('checking');
      setHealthMessage('');
      const raw = import.meta.env.VITE_API_BASE_URL;
      const baseUrl = (typeof raw === 'string' && raw.trim() !== '' ? raw.trim().replace(/\/$/, '') : '') || 'http://localhost:3003';
      const res = await fetch(`${baseUrl}/health`, { mode: 'cors' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealthStatus('ok');
      setHealthMessage(`後端正常（${data.timestamp ?? 'unknown'}）`);
    } catch (error) {
      setHealthStatus('error');
      const isDeployed = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
      setHealthMessage(
        isDeployed
          ? '無法連線到後端。'
          : '無法連線到後端服務。',
      );
    }
  };

  const statusColor =
    healthStatus === 'ok' ? 'text-emerald-600' : healthStatus === 'error' ? 'text-red-700' : 'text-muted';

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    navigate('/pos');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-forge-main px-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-surface bg-forge-card px-7 py-8 shadow-lg shadow-neutral-900/5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">POS ERP</div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-content">登入</h1>
        <p className="mb-6 text-xs text-muted" aria-hidden="true" />

        <form onSubmit={handleLogin} className="space-y-4">
          <TextInput label="帳號（暫不驗證）" placeholder="" />
          <TextInput label="密碼（暫不驗證）" type="password" placeholder="" />

          <Button type="submit" fullWidth className="mt-2" data-testid="e2e-login-submit">
            進入門市收銀
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="mt-2"
            onClick={() => navigate('/admin')}
          >
            進入後台（庫存／商品）
          </Button>
        </form>

        <div className="mt-6 border-t border-dashed border-brand-surface pt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>後端健康檢查</span>
            <Button type="button" size="sm" variant="secondary" onClick={checkHealth}>
              {healthStatus === 'checking' ? '檢查中…' : '檢查後端連線'}
            </Button>
          </div>
          <div className={`min-h-[1.2rem] text-xs ${statusColor}`}>
            {healthStatus === 'idle' && '尚未檢查'}
            {healthStatus === 'checking' && '正在檢查後端健康狀態…'}
            {healthStatus === 'ok' && healthMessage}
            {healthStatus === 'error' && healthMessage}
          </div>
          {/* 隱藏部署/連線教學內容，相關說明請移至使用手冊 */}
        </div>
      </div>
    </div>
  );
};

