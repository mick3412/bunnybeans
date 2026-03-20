import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        /** INSTRUCTIONS 033：vendor 分塊，利於快取與並行載入 */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    /** 須綁 127.0.0.1：cloudflared 用 http://127.0.0.1:5173 連線；若只綁 ::1 會 502 Bad Gateway */
    host: '127.0.0.1',
    strictPort: true,
    /** Cloudflare Quick Tunnel 會帶 Host: xxx.trycloudflare.com，須放行否則「Blocked request」 */
    allowedHosts: true,
    /** 本機未設 VITE_API_BASE_URL 時，可設為 http://localhost:3003 並用相對路徑打 API；或仍用完整 URL 直連後端 */
    proxy: {
      '/promotion-rules': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/pos': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      /** Loyalty／客戶／商家：未設 BASE_URL 時相對路徑仍轉到 Nest */
      '/loyalty': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/customers': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/merchants': { target: 'http://127.0.0.1:3003', changeOrigin: true },
    },
  },
});

