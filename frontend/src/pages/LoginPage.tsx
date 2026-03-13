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
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/health`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealthStatus('ok');
      setHealthMessage(`後端正常（${data.timestamp ?? 'unknown'}）`);
    } catch (error) {
      setHealthStatus('error');
      setHealthMessage('無法連線到後端服務，請稍後再試或檢查伺服器。');
    }
  };

  const statusColor =
    healthStatus === 'ok' ? 'text-emerald-600' : healthStatus === 'error' ? 'text-red-700' : 'text-slate-500';

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    navigate('/pos');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-7 py-6 shadow-2xl shadow-slate-900/20">
        <div className="mb-1 text-sm font-semibold tracking-wide text-slate-500">Local POS ERP</div>
        <h1 className="mb-2 text-lg font-semibold text-slate-900">登入控制台</h1>
        <p className="mb-6 text-xs text-slate-500">
          之後會在這裡接上實際的帳號 / 權限，目前先以一鍵登入快速進入 POS 介面。
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <TextInput label="帳號（暫不驗證）" placeholder="例如：store-admin" />
          <TextInput label="密碼（暫不驗證）" type="password" placeholder="任意密碼即可" />

          <Button type="submit" fullWidth className="mt-2">
            進入門市收銀
          </Button>
        </form>

        <div className="mt-6 border-t border-dashed border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>後端健康檢查</span>
            <Button type="button" size="sm" variant="secondary" onClick={checkHealth}>
              {healthStatus === 'checking' ? '檢查中…' : '檢查後端連線'}
            </Button>
          </div>
          <div className={`min-h-[1.2rem] text-[11px] ${statusColor}`}>
            {healthStatus === 'idle' && '尚未檢查'}
            {healthStatus === 'checking' && '正在檢查後端健康狀態…'}
            {healthStatus === 'ok' && healthMessage}
            {healthStatus === 'error' && healthMessage}
          </div>
        </div>
      </div>
    </div>
  );
};

