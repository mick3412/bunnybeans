#!/usr/bin/env bash
# 本機 E2E：請先在另一終端啟動後端（且已 migrate + seed）
# 用法：./scripts/e2e-local.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 檢查後端 http://localhost:3003/health =="
if ! curl -sf "http://localhost:3003/health" >/dev/null; then
  echo "後端未回應。請先執行："
  echo "  cd backend && 設定 DATABASE_URL 後："
  echo "  pnpm prisma:db:push   # 或 migrate"
  echo "  pnpm db:seed"
  echo "  pnpm dev              # 另開終端，監聽 :3003"
  exit 1
fi
echo "後端 OK"

echo "== Playwright Chromium（若未裝）=="
pnpm exec playwright install chromium 2>/dev/null || true

echo "== 跑 E2E（會自動起 Vite :5173）=="
pnpm e2e
