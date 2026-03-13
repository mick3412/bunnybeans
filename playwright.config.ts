import { defineConfig, devices } from '@playwright/test';

/**
 * POS E2E：須先啟後端（預設 :3003）、DATABASE_URL、pnpm --filter pos-erp-backend db:seed
 * 見 docs/e2e-pos.md
 */
export default defineConfig({
  testDir: 'e2e',
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
    // 本機 5173 已被 Vite 佔用時改 true，避免「port in use」；CI 設 CI=1 強制起新服
    reuseExistingServer: process.env.CI !== '1',
    timeout: 120_000,
  },
});
