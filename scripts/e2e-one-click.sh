#!/usr/bin/env bash
# 一鍵 E2E：後端未起時嘗試在背景啟動（需專案根 .env 或 backend 可讀到 DATABASE_URL）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# 載入常見環境變數（不覆蓋已設定的）
load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f" 2>/dev/null || true
  set +a
}
load_env "$ROOT/.env"
load_env "$ROOT/backend/.env"

BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "== 可關閉背景後端：kill $BACKEND_PID（或留著繼續開發）=="
  fi
}
trap cleanup EXIT

wait_health() {
  local i
  for i in $(seq 1 90); do
    if curl -sf "http://localhost:3003/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! curl -sf "http://localhost:3003/health" >/dev/null; then
  echo "== 後端未回應，嘗試背景啟動（backend pnpm dev）=="
  (cd "$ROOT/backend" && pnpm dev >/tmp/pos-e2e-backend.log 2>&1) &
  BACKEND_PID=$!
  echo "後端 PID $BACKEND_PID，日誌 /tmp/pos-e2e-backend.log"
  if ! wait_health; then
    echo "後端 90 秒內未就緒。請檢查 DATABASE_URL、pnpm prisma:db:push、pnpm db:seed"
    echo "日誌尾端："
    tail -20 /tmp/pos-e2e-backend.log || true
    exit 1
  fi
  echo "後端已就緒"
else
  echo "後端已在執行"
fi

pnpm exec playwright install chromium 2>/dev/null || true
echo "== 跑 Playwright E2E =="
pnpm e2e

echo ""
echo "== 完成 =="
