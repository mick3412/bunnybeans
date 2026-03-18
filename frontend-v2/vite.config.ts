import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/promotion-rules': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/pos': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/loyalty': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/customers': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/merchants': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/stores': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/products': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/suppliers': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/purchase-orders': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/receiving-notes': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/inventory': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/categories': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/warehouses': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:3003', changeOrigin: true },
      '/finance': { target: 'http://127.0.0.1:3003', changeOrigin: true },
    },
  },
});
