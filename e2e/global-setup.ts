/**
 * E2E 測試前執行 e2e-seed，確保掛帳等 E2E 客戶 fixture 存在。
 * 須先有 db:seed，DATABASE_URL 需可連後端 DB。
 * 失敗時僅輸出警告，不中斷測試（CI 無 DB 時仍可跑其他 spec）。
 */
import { spawnSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const cwd = path.resolve(__dirname, '..');
  const result = spawnSync('pnpm', ['--filter', 'pos-erp-backend', 'e2e:seed'], {
    cwd,
    shell: true,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    console.warn(
      '[e2e globalSetup] e2e-seed 未成功（可能是 DATABASE_URL 未設或 db:seed 未執行）：',
      result.stderr?.slice(0, 300) ?? result.stdout?.slice(0, 300),
    );
  }
}
