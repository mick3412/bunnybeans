import { defineConfig, devices } from '@playwright/test';

/**
 * POS E2E：須先啟後端（預設 :3003）、DATABASE_URL、pnpm --filter pos-erp-backend db:seed
 * 見 docs/e2e-pos.md
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter pos-erp-frontend exec vite --port 5173',
    url: 'http://localhost:5173',
    // 本機常會已有 Vite 佔用 5173；一律重用既有 server，避免「port in use」中斷本機驗收
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
