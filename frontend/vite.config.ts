import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    /** 須綁 127.0.0.1：cloudflared 用 http://127.0.0.1:5173 連線；若只綁 ::1 會 502 Bad Gateway */
    host: '127.0.0.1',
    strictPort: true,
    /** Cloudflare Quick Tunnel 會帶 Host: xxx.trycloudflare.com，須放行否則「Blocked request」 */
    allowedHosts: true,
    /** 本機未設 VITE_API_BASE_URL 時，可設為 http://localhost:3003 並用相對路徑打 API；或仍用完整 URL 直連後端 */
    proxy: {
      '/promotion-rules': { target: 'http://localhost:3003', changeOrigin: true },
      '/pos/promotions': { target: 'http://localhost:3003', changeOrigin: true },
    },
  },
});

