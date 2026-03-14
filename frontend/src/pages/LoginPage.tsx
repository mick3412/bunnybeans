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
          ? '無法連線到後端。若使用 Vercel + Cloudflare Tunnel：請在 Vercel 設定 VITE_API_BASE_URL 為「後端 tunnel 的 https 網址」（勿結尾 /），儲存後 Redeploy；並確認本機已跑後端 :3003 且 cloudflared 視窗仍開著。詳見 repo 內 docs/deploy-preview.md（環境變數與 Named Tunnel）。'
          : '無法連線到後端服務。請確認後端已啟動（預設 http://localhost:3003）、或於 .env 設定 VITE_API_BASE_URL；若用 Tunnel，請填 Tunnel 的 https 網址後重新 build。詳見 docs/deploy-preview.md。',
      );
    }
  };

  const statusColor =
    healthStatus === 'ok' ? 'text-emerald-600' : healthStatus === 'error' ? 'text-red-700' : 'text-slate-500';

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    navigate('/pos');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-forge-main px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-forge-card px-7 py-8 shadow-lg shadow-neutral-900/5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">POS ERP</div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-neutral-900">登入</h1>
        <p className="mb-6 text-xs text-slate-500">
          之後會在這裡接上實際的帳號 / 權限，目前先以一鍵登入快速進入 POS 介面。
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <TextInput label="帳號（暫不驗證）" placeholder="例如：store-admin" />
          <TextInput label="密碼（暫不驗證）" type="password" placeholder="任意密碼即可" />

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
          <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-[11px] text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">連不上後端？部署與 Tunnel</summary>
            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
              <li>
                Vercel：設定 <code className="rounded bg-white px-0.5">VITE_API_BASE_URL</code> = 後端 https（Named
                Tunnel 固定網域最佳），儲存後 <strong>Redeploy</strong>。
              </li>
              <li>
                後台寫入若開 guard：同時設定{' '}
                <code className="rounded bg-white px-0.5">VITE_ADMIN_API_KEY</code>（與後端 ADMIN_API_KEY 同值）。
              </li>
              <li>完整步驟見 repo <code className="rounded bg-white px-0.5">docs/deploy-preview.md</code></li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
};

